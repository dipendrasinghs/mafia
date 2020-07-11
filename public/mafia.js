let socket = io()
let chatroom = document.getElementById("chatroom")

// Vue.component('RecycleScroller', VueVirtualScroller.RecycleScroller)
socket.on('*', (data)=>{
    console.log(data)
})

socket.on('afkWarning', (data)=>{
    getConfirmation()
})
socket.on('afkKicked'), ()=>{
    location.reload()
}

function getConfirmation() {
    var retVal = confirm("Are you there?");
    if( retVal == true ) {
       socket.emit('stillhere')
    } else {
       return false;
    }
 }




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
        gameOver: false,
        picked: '',
        updates: [],
        ts:'',
        daytime: false
    },
    computed: {
        pickButtonText: function(){
            if(this.daytime){
                return "vote out"
            }
            else if(this.role === 'mafia'){
                return 'assassinate'
            }
            else if(this.role === 'detective'){
                return 'suspect'
            }
            else if(this.role === 'healer'){
                return 'heal'
            }
        }
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
        updates = [],
        daytime = false
    },
    // watch:{
    //     picked: function(){
    //         disableVoting()
    //         this.sendVote()
    //     }
    // },
    methods:{
        isMyMessage(msg){
            if(msg.nickname==getName())
                return true
            return false
        },
        scrollToBottom () {
            this.$refs.scroller.scrollToBottom()
        },

        sendMessage: function(){
            if(this.textMessage){
                if(this.role === 'spectator' && (this.gameOver == false)){}
                else{
                    socket.emit('sendMsg', this.textMessage)
                }
                this.textMessage = ''
                this.scrollToBottom()
            }
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
            if(this.picked === ''){
                statusAlerts('choose something')
            }
            else{
                console.log("send vote to "+this.picked)
                disableVoting()
                socket.emit('vote', this.picked)
            }
        }
    },

    created(){
        socket.on('daytime', ()=>{
            this.daytime = true
        })

        socket.on('nighttime',()=>{
            this.daytime = false
        })

        socket.on('update', (update)=>{
            this.updates.push(update)
            this.$refs.updates.scrollToBottom()
        })

        socket.on('msg', (msg) => {
            this.messages.push(msg)
            this.scrollToBottom()
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
            // this.picked=''
            enableVoting()
            unvote()
        })

        socket.on('sleep', ()=>{
            console.log("sleep")
            enableVoting()
            unvote()
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
            // this.picked = ''
            this.updates = []
            enableVoting()
            unvote()
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
            if(this.nickname === ''){
                statusAlerts("people with no name are not allowed")
            }
            else if(this.roomname === ''){
                statusAlerts("room name is needed to create a room")
            }
            else{
                socket.emit('createRoom', {
                    room: this.roomname,
                    nickname: this.nickname,
                    password: this.password
                })
            }
        },
        joinRoom: function(){
            if(this.nickname === ''){
                statusAlerts("people with no name are not allowed")
            }
            else{
                socket.emit('joinRoom', {
                    room: this.roomname,
                    nickname: this.nickname,
                    password: this.password
                })
            }
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
function disableVoting(){
    try{
        var pick = document.getElementById("pick");
        pick.disabled = true
        var radios = document.getElementsByName( "voting" );
        for( i = 0; i < radios.length; i++ ) {
        radios[i].disabled=true
        }
    }
    catch(err){
        console.log("unable to disable voting")
    }
    return null;
}

function enableVoting(){
    try{
        field.picked = ''
        var pick = document.getElementById("pick");
        pick.disabled = false
        var radios = document.getElementsByName( "voting" );
        for( i = 0; i < radios.length; i++ ) {
        radios[i].disabled=false
        }
    }
    catch(err){
        console.log("unable to enable voting")
    }
    return null;
}

function unvote(){
    field.updates = [] 
    field.picked=''
    var radios = document.getElementsByName( "voting" );
    for( i = 0; i < radios.length; i++ ) {
       radios[i].checked=false
    }
    return null;
}

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
        "border": "1px solid #ff1010"
      },
      alert: {
        
      }
    }
  });

function getName(){
    return nav.name
}

function setRole(role){
    nav.role = role
}

function setName(name){
    nav.name = name
}

function statusAlerts(message){
    // $('.notifyjs-corner').empty();
    $.notify(message.toLowerCase(), {
        style: 'statusAlerts',
        className: 'alert'
      });
}