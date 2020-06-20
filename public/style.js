let socket = io()
var room = new Vue({
    el: '#field',
    data:{
        mode: 'mafia',
        textMessage: '',
        messages: ''
    },
    methods:{
        sendMessage: function(){
            socket.emit('sendMsg', this.textMessage)
            this.textMessage = ''
        },

        toggle: function(){
            socket.emit('toggle')
        }
    },

    created(){
        socket.on('msg', (msg) => {
            this.messages = this.messages + msg
        })

        socket.on('gameStats', (data)=>{
            this.mode = data.mode
        })
    }
});

var field = new Vue({
    el: '#landing',
    data:{
        nickname:'',
        roomname:'',
        password:'',
        status:''
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
        }
    },
    created(){
        socket.on('createResponse', (data)=>{
            this.status = data.status + ' ' + data.msg 
        })
        socket.on('joinResponse', (data)=>{
            this.status = data.status + ' ' + data.msg
        })
    }
})