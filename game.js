class Game {
    constructor(room) {
        this.order = ['mafia', 'healer', 'detective', 'villager']
        this.messages = []
        this.over = false
        this.currentTurn = 'mafia'
        this.room = room
        this.room.lock = false
    }

    start(){
        this.room.lock = true
        console.log("Game Restarted")
    }


}


module.exports = Game;