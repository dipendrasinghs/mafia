function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
    while (0 !== currentIndex) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    return array;
}

var events = require('events');

class Game {
    constructor(room) {
        this.over = false
        this.gameEvents = new events.EventEmitter()
        this.room = room
        this.players = room.players
        this.room.lock = false
        this.votes = []
        this.io = room.io
        this.daytime = false
        this.roleMap = {}
    }

    start(counts){
        console.log("Game Started")
        this.over = false
        this.room.lock = true
        this.daytime = false
        this.roleMap = {}
        this.unassignRoles()
        this.assignRoles(counts)
        this.notifyRoles()
        this.setEvents()
        this.setVoteEvents()
        this.startCycle()
    }

    sendTo(role, event, msg){
        if(role === 'all') this.room.sendToAll(event, msg)
        else this.room.io.to(this.room.name+role).emit(event, msg)
    }
    makeAnnouncement(role, announcement){
        if(role === 'all'){
            console.log("making announcement to "+this.getAddresser(role))
            this.sendTo('all', 'announcement', announcement)
            // this.room.sendToAll('announcement', announcement)
            // this.room.io.to(this.getAddresser(role)).emit('announcement', announcement)
        }
        else{
            console.log("making announcement to "+this.getAddresser(role))
            this.sendTo(role,'announcement', announcement)
            // this.room.io.to(this.getAddresser(role)).emit('announcement', announcement)
            console.log("making announcement to "+this.getAddresser('spectator'))
            this.sendTo('spectator','announcement', announcement)
            // this.room.io.to(this.getAddresser('spectator')).emit('announcement', announcement)
        }
    }

    nextInFlow(role){
        if(role === 'mafia'){
            this.gameEvents.emit('mafiaSleeps')
            this.gameEvents.emit('detectiveWakesUp')
        }
        else if(role === 'detective'){
            this.gameEvents.emit('detectiveSleeps')
            this.gameEvents.emit('healerWakesUp')
        }
        else if(role === 'healer'){
            this.gameEvents.emit('healerSleeps')
            this.gameEvents.emit('everyoneWakesUp')
        }
        else{
            this.startCycle()
        }
    }
    setVoteEvents(){
        this.gameEvents.on('voteResults', (results)=>{
            if (!this.over){
                let role = results.role
                let winner = results.majority
                switch(role){
                    case "mafia":
                        this.mafiaKills(winner)
                        this.nextInFlow('mafia')
                        break;
                    case "detective":
                        this.detectiveDetects(winner)
                        this.nextInFlow('detective')
                        break;
                    case "healer":
                        this.healerheals(winner)
                        this.nextInFlow('healer')
                        break;
                    case "villager":
                        this.villagerKills(winner)
                        this.nextInFlow('villager')
                        break;
                }
            }
        })
    }

    mafiaKills(player){
        this.players[player].onDeathBed = true
        this.makeAnnouncement('mafia', "Mafia puts :"+this.players[player].nickname+": on Death bed")
    }

    detectiveDetects(player){
        let isMafia = (this.players[player].role === 'mafia')
        let playerName = this.players[player].nickname
        if(isMafia){
            this.makeAnnouncement('detective', "Detectives suspects :"+playerName+":. The suspicion turns out :correct:")
        }
        else{
            this.makeAnnouncement('detective', "Detectives suspects :"+playerName+":. The suspicion turns out :wrong:")
        }
    }

    healerheals(player){
        this.players[player].onDeathBed = false
        this.makeAnnouncement('healer', "Healer heals :"+this.players[player].nickname+":")
    }

    kill(playerid){
        try{
            console.log("Kill: "+playerid)
            let player = this.players[playerid]
            delete this.roleMap[player.role][player.id]
            player.dead = true
            player.ss.leave(this.getAddresser(player.role))
            player.role = 'spectator'
            player.ss.join(this.getAddresser(player.role))
            player.ss.emit('roleAssign', 'spectator')
            this.isGameOver()
        }
        catch(err){
            console.error("Couldnt kill"+playerid)
        }
    }

    isGameOver(){
        let mafia = 0
        let other = 0
        for(let p in this.players){
            if(this.players[p].role === 'mafia'){
                mafia = mafia + 1
            }
            else if(this.players[p].role !== 'spectator'){
                other += 1
            }
        }
        if (mafia > other){
            console.log("game over")
            this.over = true
            this.gameEvents.emit('gameOver', 'mafia')
        }
        else if(mafia == 0){
            console.log("game over")
            this.over = true
            this.gameEvents.emit('gameOver', 'villagers')
        }
    }

    villagerKills(player){
        let isMafia = (this.players[player].role === 'mafia')
        let playerName = this.players[player].nickname
        this.kill(player)
        if(isMafia){
            this.makeAnnouncement('all', "Villagers kills :"+playerName+": who was a mafia")
        }
        else{
            this.makeAnnouncement('all', "Villagers kills :"+playerName+": who was not a mafia")
        }
    }

    startCycle(){
        if(!this.over){
            this.gameEvents.emit('everyoneSleeps')
            // this.gameEvents.emit('mafiaWakesUp')
        }
    }

    voteTime(role){
        this.votes = []
        let voteAgainst = []
        for(let p in this.players){
            let player = this.players[p]
            if(player.role === 'spectator'){
                continue
            }
            if((role === 'mafia' || role === 'detective') && player.role == role){
                continue
            }
            voteAgainst.push({
                nickname: player.nickname,
                id: player.id
            })
        }
        console.log('Voteagainst: '+JSON.stringify(voteAgainst)+ " with role: "+role)
        this.sendTo(role, 'voteAgainst', voteAgainst)
        // this.room.io.to(this.getAddresser(role)).emit('voteAgainst', voteAgainst)
    }

    checkVotes(role){
        if(this.daytime){
            role = 'villager'
        }
        let total = 0
        for(let player in this.players){
            if(this.players[player].role === 'spectator') continue
            if(role === 'villager' || this.players[player].role === role){
                total += 1
            }
        }
        if(total == this.votes.length){
            let majority = this.getVerdict()
            if (majority == null){
                this.noMajority(role)
                this.votes = []
            }
            else{
                console.log("sending vote results")
                this.gameEvents.emit('voteResults', {
                    majority: majority,
                    role: role
                })
            }
        }
    }

    noMajority(role){
        if(this.daytime) role = 'all'
        this.makeAnnouncement(role, "No majority")
        this.sendTo(role, 'unvote')
    }

    getAddresser(role){
        if(role === 'all'){
            console.log("sending it to room: "+this.room.name)
            return this.room.name
        }
        return this.room.name + role
    }

    getVerdict(){
        let array = this.votes
        if(array.length == 0) return null;
        var modeMap = {};
        var maxEl = array[0], maxCount = 1;
        for(var i = 0; i < array.length; i++){
            var el = array[i];
            if(modeMap[el] == null)
                modeMap[el] = 1;
            else
                modeMap[el]++;  
            if(modeMap[el] > maxCount){
                maxEl = el;
                maxCount = modeMap[el];
            }
        }
        let ls = Object.values(modeMap)
        if(ls.length == 1){
            return maxEl;
        }
        ls = ls.sort().reverse()
        if(ls[0] == ls[1]){
            return null;
        }
        return maxEl;
    }

    everyoneSleeps(){
        this.daytime = false
        for(let player in this.players){
            this.players[player].onDeathBed = false
        }
        this.sendTo('all', 'sleep')
        this.gameEvents.emit('mafiaWakesUp')
    }

    mafiaWakesUp(){
        if(Object.keys(this.roleMap['mafia']).length == 0) this.nextInFlow('mafia')
        console.log("mafia wake up")
        this.sendTo('mafia', 'wakeup')
        // this.room.io.to(this.getAddresser('mafia')).emit('wakeup')
        this.gameEvents.emit('voteTime', 'mafia')
    }

    mafiaSleeps(){
        console.log("sleep to mafia")
        this.sendTo('mafia', 'sleep')
        // this.room.io.to(this.getAddresser('mafia')).emit('sleep')
    }

    healerWakesUp(){
        if(Object.keys(this.roleMap['healer']).length == 0) this.nextInFlow('healer')
        console.log("wakeup to healer")
        this.sendTo('healer', 'wakeup')
        // this.room.io.to(this.getAddresser('healer')).emit('wakeup')
        this.gameEvents.emit('voteTime', 'healer')
    }

    healerSleeps(){
        console.log("sleep to healer")
        this.sendTo('healer', 'sleep')
        // this.room.io.to(this.getAddresser('healer')).emit('sleep')
    }

    detectiveWakesUp(){
        if(Object.keys(this.roleMap['detective']).length == 0) this.nextInFlow('detective')
        console.log("wakeup to detective")
        this.sendTo('detective', 'wakeup')
        // this.room.io.to(this.getAddresser('detective')).emit('wakeup')
        this.gameEvents.emit('voteTime', 'detective')
    }

    detectiveSleeps(){
        console.log("sleep to detective")
        this.sendTo('detective', 'sleep')
        // this.room.io.to(this.getAddresser('detective')).emit('sleep')
    }

    everyOneWakesUp(){
        this.isGameOver()
        let mafiaKilled = this.checkIfMafiaKilledSomeone()
        if(mafiaKilled == null){
            this.makeAnnouncement('all', 'No one was killed in the night')
        }
        else{
            this.makeAnnouncement('all', ':'+this.players[mafiaKilled].nickname+": was killed by the mafia in the night")
            this.kill(mafiaKilled)
        }
        this.daytime = true
        console.log("wakeup to all")
        this.sendTo('all', 'wakeup')
        // this.room.sendToAll('wakeup')
        this.gameEvents.emit('voteTime', 'all')

    }

    checkIfMafiaKilledSomeone(){
        for(let p in this.players){
            if(this.players[p].onDeathBed){
                return p
            }
        }
        return null
    }
    
    setEvents(){
        this.gameEvents.on('everyoneSleeps', () => {this.everyoneSleeps()})
        this.gameEvents.on('mafiaWakesUp', () => {this.mafiaWakesUp()})
        this.gameEvents.on('mafiaSleeps', () => {this.mafiaSleeps()})
        this.gameEvents.on('healerWakesUp', () => {this.healerWakesUp()})
        this.gameEvents.on('healerSleeps', () => {this.healerSleeps()})
        this.gameEvents.on('detectiveWakesUp', () => {this.detectiveWakesUp()})
        this.gameEvents.on('detectiveSleeps', () => {this.detectiveSleeps()})
        this.gameEvents.on('everyoneWakesUp', () => {this.everyOneWakesUp()})
        this.gameEvents.on('voteTime', (role) => {this.voteTime(role)})
        this.gameEvents.on('gameOver', (winner) => {this.gameOver(winner)})
    }

    gameOver(winner){
        this.unassignRoles()
        this.makeAnnouncement('all', ":"+winner+": has won the game")
        console.log("gameOver")
        this.over = true
        this.sendTo('all', 'gameOver')
        // this.room.sendToAll('gameOver')
    }

    notifyRoles(){
        this.sendTo('mafia', 'roleAssign', 'mafia')
        this.sendTo('detective', 'roleAssign', 'detective')
        this.sendTo('healer', 'roleAssign', 'healer')
        this.sendTo('villager', 'roleAssign', 'villager')
        // this.room.io.to(this.getAddresser('mafia')).emit('roleAssign', 'mafia')
        // this.room.io.to(this.getAddresser('healer')).emit('roleAssign', 'healer')
        // this.room.io.to(this.getAddresser('detective')).emit('roleAssign', 'detective')
        // this.room.io.to(this.getAddresser('villager')).emit('roleAssign', 'villager')
    }

    assignRoles(counts){
        let roles = []
        this.roleMap['mafia'] = {}
        this.roleMap['healer'] = {}
        this.roleMap['detective'] = {}
        this.roleMap['villager'] = {}
        let totalPlayers = Object.keys(this.players).length;
        for(var i = 0; i < counts.mafiaCount; i++){
            roles.push('mafia')
        }
        for(var i = 0; i < counts.healerCount; i++){
            roles.push('healer')
        }
        for(var i = 0; i < counts.detectiveCount; i++){
            roles.push('detective')
        }
        for(var i = 0; i < totalPlayers - counts.mafiaCount - counts.healerCount - counts.detectiveCount; i++){
            roles.push('villager')
        }
        roles = shuffle(roles)
        let c = 0
        for(let player in this.players){
            this.players[player].role = roles[c]
            this.players[player].ss.join(this.room.name + roles[c])
            this.players[player].ss.on('vote', (kill) => {
                this.votes.push(kill)
                this.checkVotes(this.players[player].role)
            })
            this.roleMap[roles[c]][player] = this.players[player]
            c = c+1
        }
    }

    unassignRoles(){
        for(let player in this.players){
            this.players[player].ss.leave(this.room.name+this.players[player].role)
            this.players[player].role = 'undefined'
        }
    }
}


module.exports = Game;