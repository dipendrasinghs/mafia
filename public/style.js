let socket = io()
var field = new Vue({
    el: '#field',
    data:{
        role: '',
        textMessage: '',
        messages: [],
        visible: false,
        sleeping: true, 
        voteAgainst: [],
        announcement: '', 
        gameOver: '',
        picked: ''
    },
    methods:{
        sendMessage: function(){
            socket.emit('sendMsg', this.textMessage)
            this.textMessage = ''
        },

        toggle: function(){
            socket.emit('toggle')
        },

        newGame: function(){
            socket.emit('startNewGame')
            this.gameOver = false
            this.messages = []
            this.announcement = ''
        },

        proceedToLobby: function(){
            proceedToLobby()
        }, 

        sendVote: function(){
            socket.emit('vote', this.picked)
        }
    },

    created(){
        socket.on('msg', (msg) => {
            this.messages.push(msg)
        })

        socket.on('gameStats', (data)=>{
            this.mode = data.mode
        })

        socket.on('newGameResponse', ()=>{
            this.proceedToLobby()
        })

        socket.on('roleAssign', (role)=>{
            this.role = role
        })

        socket.on('voteAgainst', (voteAgainst)=>{
            this.voteAgainst = voteAgainst
        })

        socket.on('sleep', ()=>{
            this.sleeping = true
        })

        socket.on('wakeup', ()=>{
            this.sleeping = false
        })

        socket.on('announcement', (announcement)=>{
            this.announcement = this.announcement + ' <br>' + announcement
        })

        socket.on('gameOver', ()=>{
            this.gameOver = true
        })
        
        socket.on('unvote', ()=>{
            picked = ''
        })
    }
});

var landing = new Vue({
    el: '#landing',
    data:{
        nickname:'',
        roomname:'',
        password:'',
        status:'', 
        visible: true
    },
    methods:{
        createRoom: function(){
            socket.emit('createRoom', {
                room: this.roomname,
                nickname: this.nickname,
                password: this.password
            })
        },
        joinRoom: function(){
            socket.emit('joinRoom', {
                room: this.roomname,
                nickname: this.nickname,
                password: this.password
            })
        },
        proceedToLobby: function(){
            proceedToLobby()
        }
    },
    created(){

        socket.on('createResponse', (data)=>{
            if(data.success){
                this.proceedToLobby()
                this.status = data.status + ' ' + data.msg
            }
            else{
                this.status = data.status + ' ' + data.msg
            }
        })
        socket.on('joinResponse', (data)=>{
            if(data.success){
                this.proceedToLobby()
                this.status = data.status + ' ' + data.msg
            }
            else{
                this.status = data.status + ' ' + data.msg
            }
        })
    }
})

var lobby = new Vue({
    el: '#lobby',
    data:{
        players:[],
        mafiaCount: 0,
        healerCount: 0,
        detectiveCount: 0, 
        status:'',
        visible: false
    }, 
    methods:{
        startGame: function(){
            socket.emit('startGame', {
                mafiaCount: parseInt(this.mafiaCount),
                healerCount: parseInt(this.healerCount),
                detectiveCount: parseInt(this.detectiveCount)
            })
        },
        proceedToField: function(){
            proceedToField()
        }
    },
    created(){

        socket.on('totalPlayersResponse', (players)=>{
            console.log(JSON.stringify(players))
            this.players = players
        })

        socket.on('startGameResponse', (data)=>{
            if(data.success){
                this.proceedToField()
            }
            else{
                this.status =  data.msg
            }
        })
    }
})

function proceedToLobby(){
    lobby.visible = true
    landing.visible = false
    field.visible = false
}

function proceedToField(){
    lobby.visible = false
    landing.visible = false
    field.visible = true
}