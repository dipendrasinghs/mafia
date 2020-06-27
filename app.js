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
const { platform } = require('os');

class Room {
	constructor(name, pass) {
		this.io = io
		this.room = '' + name
		this.name = '' + name
		this.password = '' + pass
		this.players = {}
		this.lock = false
		this.game
		this.playersStats = new events.EventEmitter()
		this.gameEvents = new events.EventEmitter()
		ROOM_LIST[this.room] = this
		this.initialize()
	}

	sendToAll(event, msg){
		for(let p in this.players){
			try{
				SOCKET_LIST[p].emit(event, msg)
			}catch{
				console.error(p+" : not in socketlist")
			}
		}
	}

	initialize(){
		this.playersStats.on('playerJoined', (stat)=>{
			this.sendToAll('totalPlayersResponse', this.getPlayerNames())
		})
	
		this.playersStats.on('playerLeft', (stat)=>{
			this.sendToAll('totalPlayersResponse', this.getPlayerNames())
		})

		this.gameEvents.on('newGame', ()=>{
			console.log("sending it to all"+this.room)
			this.sendToAll('newGameResponse', true)
		})

		this.gameEvents.on('startGame', (data)=>{
			let counts = data.counts
			let initiater = SOCKET_LIST[data.initiater]
			if(counts.mafiaCount == 0){
				initiater.emit('startGameResponse', {
					success: false,
					msg: '#Mafia cannot be zero'
				})
			}
			else if(counts.mafiaCount + counts.healerCount + counts.detectiveCount > Object.keys(this.players).length){
				console.log(JSON.stringify(counts) + " and total: "+Object.keys(this.players).length)
				initiater.emit('startGameResponse', {
					success: false,
					msg: 'not enough players'
				})
			}
			else if(counts.mafiaCount >= Object.keys(this.players).length - counts.mafiaCount){
				initiater.emit('startGameResponse', {
					success: false,
					msg: '#Mafia should be less than other people'
				})
			}
			else{
				// console.log(this.room+" strar")

			console.log("sending it to all"+this.room)
				this.sendToAll('startGameResponse', {
					success: true,
					msg: 'Go on'
				})
				if(this.game){
					delete this.game
				}
				this.game = new Game(this)
				this.game.start(counts)
			}
		})
	}

	someoneLeft(player, role){
		console.log("player "+player.nickname+" has left and its daytime = "+this.game.daytime+" with player role"+role)
		if(this.game.daytime){
			this.game.gameEvents.emit('voteTime', 'all')
		}
		else{
			if(role === 'mafia'){
				this.game.gameEvents.emit('mafiaWakesUp')
			}else if(role === 'detective'){
				this.game.gameEvents.emit('detectiveWakesUp')
			}else if(role === 'healer'){
				this.game.gameEvents.emit('healerWakesUp')
			}

		}
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
		this.ss = socket
		this.room = room
		this.nickname = this.getLegitName(nickname)
		this.role = ''
		this.timeout = 2100         // (35min)
		this.afktimer = this.timeout
		this.dead = false
		this.onDeathBed = false
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
	socket.on('*', (data)=>{
		console.info(data)
	})

	socket.on('vote', (person)=>{
		let player = PLAYER_LIST[socket.id]
		let room = ROOM_LIST[player.room]
		try{
			let msg = player.nickname+" chose "+PLAYER_LIST[person].nickname
			if(ROOM_LIST[player.room].game.daytime){
				ROOM_LIST[player.room].sendToAll('update', msg)
			}
			else{
				io.to(player.room+player.role).emit('update', msg)
			}
		}catch(err){
			room.game.gameEvents.emit('voteTime', player.role)
			room.game.votes = []
			room.game.sendTo(player.role, 'unvote')
			room.game.sendTo(player.role, 'announcement', "cant cast your vote, revote")
			console.log("error occurred in voting" + err)
		}
	})
	socket.on('sendMsg', (msg) => {
		let player = PLAYER_LIST[socket.id]
		let role = player.role
		messageObj = {
			from: socket.id,
			ts: Date.now(),
			nickname: player.nickname,
			textMessage: msg
		}
		console.log("Daytime: "+ROOM_LIST[player.room].game.daytime+" playerroom: "+player.room+" role: "+role)
		if(ROOM_LIST[player.room].game.daytime){
			ROOM_LIST[player.room].sendToAll('msg', messageObj)
		}
		else{
			io.to(player.room+role).emit('msg', messageObj)
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
	if (room.lock){
		socket.emit('startGameResponse', {
			success: false,
			msg: 'Room is locked'
		})
	}
	else{
		ROOM_LIST[PLAYER_LIST[socket.id].room].gameEvents.emit('startGame', {
			counts: counts,
			initiater: socket.id
		})
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
				console.log(userName+"joined"+roomName)
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
				console.log(userName+"joined"+roomName)
				socket.join(roomName)
				socket.emit('joinResponse', { success: true, msg: "you are: " + player.role + " and name is: " + player.nickname, name: player.nickname })   // Tell client join was successful
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
	if (!PLAYER_LIST[socket.id]) return
	let player = PLAYER_LIST[socket.id]
	let room = ROOM_LIST[player.room]
	room.sendToAll('announcement', ':'+player.nickname+": has left the game, skipping turns")
	let role = player.role
	try{
		room.game.kill(player.id)
		room.someoneLeft(player, role)
	}
	catch(err){
		console.log("game was not created so cannot kill "+player.id)
	}
	delete ROOM_LIST[player.room].players[player.id]
	room.playersStats.emit('playerLeft', {
		id: socket.id, 
		room: player.room
	})
	if (Object.keys(ROOM_LIST[player.room].players).length === 0) {
		deleteRoom(player.room)
	}
	// console.log("killing + "+player.id)
	// try {
	// 	ROOM_LIST[player.room].game.kill(player.id)
	// }catch(err){
	// 	console.log("room was not available to kill the game")
	// }
	
	console.log(player.nickname+"left"+player.room)
	socket.leave(player.room)
	delete PLAYER_LIST[player.id]
	socket.emit('leaveResponse', { success: true })
}

function deleteRoom(room){
	ROOM_LIST[room].remove()
	delete ROOM_LIST[room]
}

function appRestart() {
	for (let socket in SOCKET_LIST){
    SOCKET_LIST[socket].emit('serverMessage', {msg:"Server Successfully Restarted for Maintnence"})
    SOCKET_LIST[socket].emit('leaveResponse', {success:true})
  }
  heroku.delete('/apps/codenames-plus/dynos/').then(app => {})
}

function appRestartWarning() {
	for (let player in PLAYER_LIST){
    SOCKET_LIST[player].emit('serverMessage', {msg:"Scheduled Server Restart in 10 Minutes"})
  }
}
