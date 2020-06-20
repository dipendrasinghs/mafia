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

var events = require('events');
const { start } = require('repl');

class Room {
	constructor(name, pass) {
		this.room = '' + name
		this.password = '' + pass
		this.players = {}
		this.lock = false
		this.game = new Game(this)
		this.playersStats = new events.EventEmitter()
		this.gameEvents = new events.EventEmitter()
		ROOM_LIST[this.room] = this
		this.initialize()
	}

	initialize(){
		this.playersStats.on('playerJoined', (stat)=>{
			io.to(this.room).emit('totalPlayersResponse', this.getPlayerNames())
		})
	
		this.playersStats.on('playerLeft', (stat)=>{
			io.to(this.room).emit('totalPlayersResponse', this.getPlayerNames())
		})

		this.gameEvents.on('newGame', ()=>{
			io.to(this.room).emit('newGameResponse', true)
		})

		this.gameEvents.on('startGame', (counts)=>{
			if(this.lock){
				console.log("room is locked")
				io.to(this.room).emit('startGameResponse', {
					success: false,
					msg: 'Room is locked'
				})
			}
			else{
				this.game.start(counts)
				io.to(this.room).emit('startGameResponse', {
					success: true,
					msg: 'Go on'
				})
			}
		})
	}

	getPlayerNames(){
		let names = []
		let players = this.players
		for(let player in players){
			names.push(players[player].nickname)
		}
		return names
	}

	remove(){
		console.log("Deleting: "+this.room)
		this.playersStats.removeAllListeners()
		this.gameEvents.removeAllListeners()
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
					nickname: player.nickname,
					textMessage: msg
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
	socket.on('disconnect', ()=>{leaveRoom(socket)})
	socket.on('newGame', ()=>{ newGame(socket)})
	socket.on('startGame', (counts)=>{startGame(counts, socket)})
	socket.on('startNewGame', ()=>{startNewGame(socket)})
})


function newGame(socket){
	ROOM_LIST[PLAYER_LIST[socket.id].room].gameEvents.emit('newGame') 
}

function startGame(counts, socket){
	room = ROOM_LIST[PLAYER_LIST[socket.id].room]
	if (room.locked){
		socket.emit('startGameResponse', {
			success: false,
			msg: 'Room is locked'
		})
	}
	else{
		ROOM_LIST[PLAYER_LIST[socket.id].room].gameEvents.emit('startGame', counts)
	}
}

function startNewGame(socket){
	room = ROOM_LIST[PLAYER_LIST[socket.id].room]
	room.lock = false
	room.gameEvents.emit('newGame')
}

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
				room = new Room(roomName, passName)
				let player = new Player(userName, roomName, socket)
				ROOM_LIST[roomName].players[socket.id] = player
				console.log('Room created:'+roomName)
				socket.join(roomName)
				socket.emit('createResponse', { success: true, msg: "you are " + player.role + " and name is: " + player.nickname + " and id is: " + player.id })// Tell client creation was successful
				room.playersStats.emit('playerJoined', {
					id: socket.id, 
					room: roomName
				})
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
				let room = ROOM_LIST[roomName]
				ROOM_LIST[roomName].players[socket.id] = player
				socket.join(roomName)
				socket.emit('joinResponse', { success: true, msg: "you are: " + player.role + " and name is: " + player.nickname })   // Tell client join was successful
				room.playersStats.emit('playerJoined', {
					id: socket.id, 
					room: roomName
				})
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
	console.log("here is left")
	if (!PLAYER_LIST[socket.id]) return
	let player = PLAYER_LIST[socket.id]
	delete PLAYER_LIST[player.id]
	delete ROOM_LIST[player.room].players[player.id]
	console.log(Object.keys(ROOM_LIST[player.room].players).length)
	let room = ROOM_LIST[player.room]
	room.playersStats.emit('playerLeft', {
		id: socket.id, 
		room: player.room
	})
	if (Object.keys(ROOM_LIST[player.room].players).length === 0) {
		deleteRoom(player.room)
	}
	socket.leave(player.room)
	socket.emit('leaveResponse', { success: true })
}

function deleteRoom(room){
	ROOM_LIST[room].remove()
	delete ROOM_LIST[room]
}
function appRestart() {

}

function appRestartWarning() {

}
