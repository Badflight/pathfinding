class PathFindingScene extends Phaser.Scene {
    /** @type {Phaser.Tilemaps.Tilemap} */
    map
    /** @type {Player} */
    player
    /** @type  {Phaser.Physics.Arcade.Sprite} */
    gun
    /** @type {Array.<Enemy>} */
    enemies = []
    /** @type {Array.<object>} */
    enemySpawnPoints = []
    /** @type {Enemy} */
    activeEnemy
    /** @type {number} */
    minEnemies = 2
    /** @type  {Phaser.Physics.Arcade.Group} */
    bullets
    constructor() {
        super({ key: 'pathFindingScene' })
    }
    preload() {
        //tiled assets
        this.load.image('tileset', 'assets/tiles100-spacing2.png')
        this.load.tilemapTiledJSON('tilemap', 'assets/tilemap.json')
        //player assets
        this.load.image('player', 'assets/man.png')
        this.load.image('playerGun', 'assets/man-with-gun.png')
        //enenmy asset
        this.load.image('enemy', 'assets/enemy.png')
        //weapon asset
        this.load.image('gun', 'assets/gun.png')
        this.load.image('bullet', 'assets/bullet.png')

    }
    create() {
        this.map = this.make.tilemap({ key: 'tilemap' })
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels)
        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels)
        const tileset = this.map.addTilesetImage('tileset', 'tileset')
        const groundAndWallsLayer = this.map.createLayer('groundAndWallsLayer', tileset, 0, 0)
        const objectLayer = this.map.getObjectLayer('objectLayer')
        groundAndWallsLayer.setCollisionByProperty({ valid: false })
        //player creation
        objectLayer.objects.forEach(function (object) {
            let dataObject = Utils.RetrieveCustomProperties(object)
            if (dataObject.type === "playerSpawn") {
                this.player = new Player(this, dataObject.x, dataObject.y, 'player')
            }
            else if (dataObject.type === "gunSpawn") {
                //@ts-ignore
                this.gun = this.physics.add.sprite(dataObject.x, dataObject.y, 'gun')
            } else if (dataObject.type === "enemySpawn") {
                //@ts-ignore
                this.enemySpawnPoints.push(dataObject)
            }
        }, this)
        this.physics.add.collider(this.player.sprite, groundAndWallsLayer)
        this.physics.add.overlap(this.player.sprite, this.gun, this.collectGun, null, this)
        //bullet group
        this.bullets = this.physics.add.group({
            defaultKey: 'bullet',
            maxSize: 5,
            collideWorldBounds: true
        })
        this.physics.world.on('worldbounds', this.worldBoundsBullet, this)
        this.physics.add.collider(this.bullets, groundAndWallsLayer, this.bulletHitWall, null, this)
        this.events.on('firebullet', this.fireBullet, this)
        //enemy stuff
        this.events.on('enemyready', this.handleEnemyMove, this)
        this.time.delayedCall(1000, this.onEnemySpawn, [], this)
        //@ts-ignore
        this.finder = new EasyStar.js()
        //create 2d representation
        let grid = []
        for (let y = -0; y < this.map.height; y++) {
            let col = []
            for (let x = 0; x < this.map.width; x++) {
                let tile = this.map.getTileAt(x, y)
                if (tile) {
                    col.push(tile.index)
                }
                else {
                    col.push(0)
                }
            }
            grid.push(col)
        }
        this.finder.setGrid(grid)
        let properties = tileset.tileProperties
        let acceptabileTiles = []
        for (let i = tileset.firstgid - 1; i < tileset.total; i++) {
            //looks for tiles which are valid
            if (properties[i] && properties[i].valid) {
                acceptabileTiles.push(i + 1)
            }
        }
        //which tiles the enemy can use
        this.finder.setAcceptableTiles(acceptabileTiles)
    }
    findPath(point) {
        //point object has x and y in pixels
        let toX = Math.floor(point.x / this.map.tileWidth)
        let toY = Math.floor(point.y / this.map.tileHeight)
        let fromX = Math.floor(this.activeEnemy.sprite.x / this.map.tileWidth)
        let fromY = Math.floor(this.activeEnemy.sprite.y / this.map.tileHeight)
        console.log('going from' + fromX + '+' + fromY + 'to' + toX + 'and' + toY)
        let callback = this.moveEnemy.bind(this)
        this.finder.findPath(fromX, fromY, toX, toY, function (path) {
            if (path === null) {
                console.warn("path not found")
            }
            else {
                console.log('its fine')
                callback(path)
            }
        })
        //execute
        this.finder.calculate()
    }
    moveEnemy(path) {
        console.log(path)
    }
    onEnemySpawn() {
        let index = Phaser.Math.Between(0, this.enemySpawnPoints.length - 1)
        console.log(index)
        let spawnPoint = this.enemySpawnPoints[index]
        console.log('Spawnpoint' + spawnPoint)
        let enemy = new Enemy(this, spawnPoint.x, spawnPoint.y, 'enemy')
        enemy.targetX = spawnPoint.x
        enemy.targetY = spawnPoint.y
        this.enemies.push(enemy)
        this.physics.add.overlap(this.player.sprite, enemy.sprite, this.collideEnemy, null, this)
    }
    handleEnemyMove(enemy) {
        this.activeEnemy = enemy
        let toX = Math.floor(this.player.sprite.x / this.map.tileWidth) * this.map.tileWidth + (this.map.tileWidth / 2)
        let toY = Math.floor(this.player.sprite.y / this.map.tileHeight) * this.map.tileHeight + (this.map.tileHeight / 2)
        this.findPath({ x:toX, y:toY})
    }
    collectGun(player, gun) {
        this.gun.destroy()
        this.player.hasGun = true
        this.player.sprite.setTexture('playerGun')

    }
    fireBullet() {
        //simple way to add an offset to a sprite
        let vector = new Phaser.Math.Vector2(48, 19)
        vector.rotate(this.player.sprite.rotation)
        console.log(vector)
        let bullet = this.bullets.get(this.player.sprite.x + vector.x, this.player.sprite.y + vector.y)
        if (bullet) {
            bullet.setDepth(4)
            bullet.body.collideWorldBounds = true
            bullet.body.onWorldBounds = true
            bullet.enableBody(false, bullet.x, bullet.y, true, true)
            bullet.rotation = this.player.sprite.rotation
            this.physics.velocityFromRotation(bullet.rotation, 200, bullet.body.velocity)
        }
    }
    worldBoundsBullet(body) {
        //return bullet to object pool
        body.gameObject.disableBody(true, true)
    }
    bulletHitWall(bullet, layer) {
        bullet.disableBody(true, true)
    }
    bulletHitEnemy(enemySprite, bullet) {
    }
    collideEnemy(player, sprite) {
    }
    update(time, delta) {
        this.player.update(time, delta)
        for (let i = 0; i < this.enemies.length; i++) {
            this.enemies[i].update(time, delta)
        }
    }
}