let socket = io()
var field = new Vue({
    el: '#field',
    data:{
        mode: 'mafia',
        textMessage: '',
        messages: '', 
        visible: false
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
        },

        proceedToLobby: function(){
            proceedToLobby()
        }
    },

    created(){
        socket.on('msg', (msg) => {
            this.messages = this.messages + msg.textMessage
        })

        socket.on('gameStats', (data)=>{
            this.mode = data.mode
        })

        socket.on('newGameResponse', ()=>{
            this.proceedToLobby()
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
                mafiaCount: this.mafiaCount,
                healerCount: this.healerCount,
                detectiveCount: this.detectiveCount
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