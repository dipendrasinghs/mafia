let express = require('express')

let app = express()
let server = app.listen(process.env.PORT || 2000, listen);

function listen() {
	let host = server.address().address;
	let port = server.address().port;
	console.log('Mafia Server Started at http://' + host + ':' + port);
}

app.use(express.static('public'))


let io = require('socket.io')(server)
var middleware = require('socketio-wildcard')()
io.use(middleware)

const Game = require('./game.js')

TT = {}
TT['m1'] = 'mafia'
TT['m2'] = 'mafia'
TT['m3'] = 'mafia'
TT['d1'] = 'detective'
TT['d2'] = 'detective'

SOCKET_LIST = {}
PLAYER_LIST = {}
ROOM_LIST = {}
let restartHour = 11
let restartMinute = 0
let restartSecond = 5
let restartWarningHour = 10
let restartWarningMinute = 50
let restartWarningSecond = 2


class Room {
	constructor(name, pass) {
		this.room = '' + name
		this.password = '' + pass
		this.players = {}
		this.game = new Game()
		ROOM_LIST[this.room] = this
	}
}

class Player {
	constructor(nickname, room, socket) {
		this.id = socket.id
		this.room = room
		this.nickname = this.getLegitName(nickname)
		this.role = TT[nickname]
		this.timeout = 2100         // (35min)
		this.afktimer = this.timeout
		this.dead = false
		PLAYER_LIST[socket.id] = this
	}

	getLegitName(nickname) {
		let counter = 0
		let room = this.room
		let nameAvailable = false
		let nameExists = false
		let tempName = nickname
		while (!nameAvailable) {
			if (ROOM_LIST[room]) {
				nameExists = false;
				for (let i in ROOM_LIST[room].players) {
					if (ROOM_LIST[room].players[i].nickname === tempName) nameExists = true
				}
				if (nameExists) tempName = nickname + "(" + ++counter + ")"
				else nameAvailable = true
			}
		}
		return tempName
	}
}


io.sockets.on('connection', function (socket) {
	SOCKET_LIST[socket.id] = socket

	socket.on('sendMsg', (msg) => {
		player = PLAYER_LIST[socket.id]
		role = player.role
		playersInRoom = ROOM_LIST[player.room].players
		for (let p in playersInRoom) {
			if (PLAYER_LIST[p].role === role) {
				SOCKET_LIST[p].emit('msg', {
					from: socket.id,
					ts: Date.now(),
					nickname: player.nickname
				})
			}
		}
	})

	socket.on('*', () => {
		if (!PLAYER_LIST[socket.id]) return
		PLAYER_LIST[socket.id].afktimer = PLAYER_LIST[socket.id].timeout
	})

	socket.on('createRoom', (data) => { createRoom(socket, data) })
	socket.on('joinRoom', (data) => { joinRoom(socket, data) })

})


function createRoom(socket, data) {
	let roomName = data.room.trim()
	let passName = data.password.trim()
	let userName = data.nickname.trim()
	if (ROOM_LIST[roomName]) {
		socket.emit('createResponse', { success: false, msg: 'Room Already Exists' })
	}
	else {
		if (roomName === "") {
			socket.emit('createResponse', { success: false, msg: 'Enter A Valid Room Name' })
		}
		else {
			if (userName === '') {
				socket.emit('createResponse', { success: false, msg: 'Enter A Valid Nickname' })
			} else {
				new Room(roomName, passName)
				let player = new Player(userName, roomName, socket)
				ROOM_LIST[roomName].players[socket.id] = player
				socket.emit('createResponse', { success: true, msg: "you are " + player.role + " and name is: " + player.nickname + " and id is: " + player.id })// Tell client creation was successful
			}
		}
	}
}

function joinRoom(socket, data) {
	let roomName = data.room.trim()
	let pass = data.password.trim()
	let userName = data.nickname.trim()

	if (!ROOM_LIST[roomName]) {
		socket.emit('joinResponse', { success: false, msg: "Room Not Found" })
	} 
	else {
		if (ROOM_LIST[roomName].password !== pass) {
			socket.emit('joinResponse', { success: false, msg: "Incorrect Password" })
		} 
		else {
			if (userName === '') {
				socket.emit('joinResponse', { success: false, msg: 'Enter A Valid Nickname' })
			} 
			else {
				let player = new Player(userName, roomName, socket)
				ROOM_LIST[roomName].players[socket.id] = player
				socket.emit('joinResponse', { success: true, msg: "you are: " + player.role + " and name is: " + player.nickname })   // Tell client join was successful
			}
		}
	}
}



setInterval(() => {
	let time = new Date()
	if (time.getHours() === restartWarningHour &&
		time.getMinutes() === restartWarningMinute &&
		time.getSeconds() < restartWarningSecond) appRestartWarning()
	if (time.getHours() === restartHour &&
		time.getMinutes() === restartMinute &&
		time.getSeconds() < restartSecond) appRestart()

	for (let player in PLAYER_LIST) {
		PLAYER_LIST[player].afktimer--
		if (PLAYER_LIST[player].afktimer < 300) SOCKET_LIST[player].emit('afkWarning')
		if (PLAYER_LIST[player].afktimer < 0) {
			SOCKET_LIST[player].emit('afkKicked')
			leaveRoom(SOCKET_LIST[player])
		}
	}
}, 1000)

function leaveRoom(socket) {
	if (!PLAYER_LIST[socket.id]) return
	let player = PLAYER_LIST[socket.id]
	delete PLAYER_LIST[player.id]
	delete ROOM_LIST[player.room].players[player.id]
	if (Object.keys(ROOM_LIST[player.room].players).length === 0) {
		delete ROOM_LIST[player.room]
	}
	socket.emit('leaveResponse', { success: true })
}


function appRestart() {

}

function appRestartWarning() {

}