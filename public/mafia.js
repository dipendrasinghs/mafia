let socket = io()

socket.on('*', (data)=>{
    console.log(data)
})


var nav = new Vue({
    el: '#navigation',
    data: {
        role:'',
        name: ''
    }
});
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
        picked: '',
        updates: []
    },
    mounted(){
        role = ''
        textMessage = ''
        messages = []
        visible = false
        sleeping = true
        voteAgainst = []
        announcement = '' 
        gameOver = ''
        picked = ''
        updates = []
    },
    methods:{
        sendMessage: function(){
            if (role !== 'spectator' && !gameOver)
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
        socket.on('update', (update)=>{
            this.updates.push(update)
        })

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
            setRole(role)
        })

        socket.on('voteAgainst', (voteAgainst) => {
            this.voteAgainst = voteAgainst
        })

        socket.on('sleep', ()=>{
            console.log("sleep")
            this.updates = []
            this.sleeping = true
        })

        socket.on('wakeup', ()=>{
            console.log("wakeup")
            this.sleeping = false
        })

        socket.on('announcement', (announcement)=>{
            statusAlerts(announcement)
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
        nickname:'m1',
        roomname:'h1',
        password:'h1',
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
                setName(this.nickname)
                this.proceedToLobby()
                this.status = data.status + ' ' + data.msg
            }
            else{
                statusAlerts(data.msg)
                this.status = data.status + ' ' + data.msg
            }
        })
        socket.on('joinResponse', (data)=>{
            if(data.success){
                setName(data.name)
                this.proceedToLobby()
                this.status = data.status + ' ' + data.msg
            }
            else{
                statusAlerts(data.msg)
                this.status = data.status + ' ' + data.msg
            }
        })
    }
})

var lobby = new Vue({
    el: '#lobby',
    data:{
        players:[],
        mafiaCount: '',
        healerCount: '',
        detectiveCount: '', 
        status:'',
        visible: false
    }, 
    methods:{
        startGame: function(){
            socket.emit('startGame', {
                mafiaCount: parseInt(this.mafiaCount) || 0,
                healerCount: parseInt(this.healerCount) || 0,
                detectiveCount: parseInt(this.detectiveCount) || 0
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
            console.log(JSON.stringify(data))
            if(data.success){
                this.proceedToField()
            }
            else{
                statusAlerts(data.msg)
                this.status =  data.msg
            }
        })
    }
})

function proceedToLobby(){
    lobby.visible = true
    landing.visible = false
    field.visible = false
    nav.role=''
}

function proceedToField(){
    // console.log("this happened")
    lobby.visible = false
    landing.visible = false
    field.visible = true
    field.gameOver = false
}

$.notify.addStyle('statusAlerts', {
    html: "<div><span data-notify-text/></div>",
    classes: {
      base: {
        "white-space": "nowrap",
        "background-color": "#091918",
        "padding": "15px",
        "margin-top":"75px",
        "border": "1px solid #ff1010"
      },
      alert: {
        
      }
    }
  });

function setRole(role){
    nav.role = role
}

function setName(name){
    nav.name = name
}

function statusAlerts(message){
    $('.notifyjs-corner').empty();
    $.notify(message.toLowerCase(), {
        style: 'statusAlerts',
        className: 'alert'
      });
}