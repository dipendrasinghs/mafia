class Game {
    constructor() {
        this.order = ['mafia', 'healer', 'detective', 'villager']
        this.messages = []
        this.over = false
        this.currentTurn = 'mafia'
    }
}


module.exports = Game;