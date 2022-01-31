class PathFindingScene extends Phaser.Scene {
    /** @type {Phaser.Tilemaps.Tilemap} */
    map
    /** @type {Player} */
    player
    /** @type  {Phaser.Physics.Arcade.Sprite} */
    gun
    /** @type {Array.<Enemy>} */
    enemies = []
    /**@type {Array.<Collectable>} */
    collectables
    /**@type {number} */
    collectionTotal = 0
    /**@type {number} */
    doorDestX = 0
    /**@type {Collectable} */
    singularCollectable
    /** @type {Array.<object>} */
    enemySpawnPoints = []
    /**@type {Door} */
    door
    /** @type {Enemy} */
    activeEnemy
    /** @type {number} */
    minEnemies = 2
    /** @type  {Phaser.Physics.Arcade.Group} */
    bullets
    /**@type {Phaser.Physics.Arcade.Group} */
    ammoClips
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
        this.load.image('deadEnemy', 'assets/dead-enemy.png')
        //weapon asset
        this.load.image('gun', 'assets/gun.png')
        this.load.image('bullet', 'assets/bullet.png')
        this.load.image('ammo', 'assets/ammoClip.png')
        //door asset
        this.load.image('door', 'assets/door.png')
        //collectable asset
        this.load.image('collectable1', 'assets/blue-jewel.png')
        this.load.image('trophey','assets/trophey-1.png')

    }
    create() {
        this.map = this.make.tilemap({ key: 'tilemap' })
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels)
        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels)
        const tileset = this.map.addTilesetImage('tileset', 'tileset')
        const groundAndWallsLayer = this.map.createLayer('groundAndWallsLayer', tileset, 0, 0)
        const objectLayer = this.map.getObjectLayer('objectLayer')
        //const gameOverLayer = this.map.createLayer('gameOverTiles', tileset, 0, 0)
        groundAndWallsLayer.setCollisionByProperty({ valid: false })
        //gameOverLayer.setCollisionByProperty({ valid: false })
        //index overlap for player

        let ammoObjects = []
        let collectablePoints = []
        let doorDestX = 0
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
            else if (dataObject.type === "doorSpawn") {
                this.door = new Door(this, dataObject.x, dataObject.y, 'door')
            }
            else if (dataObject.type === "doorDest") {
                console.log('door')
                //@ts-ignore
                this.door.doorDest(dataObject.x, dataObject.y)

                this.doorDestX = dataObject.x
            }
            else if (dataObject.type === "ammoPickup") {
                ammoObjects.push(dataObject)
            }
            else if (dataObject.type === "collectableSpawn") {
                collectablePoints.push(dataObject)
            }
            else if(dataObject.type ==="tropheySpawn"){
                this.trophey = new Collectable(this,dataObject.x,dataObject.y,'trophey')
                console.log('trophey')
            }
        }, this)
        for (let i = 0; i < collectablePoints.length; i++) {
            this.createCollectable(collectablePoints[i])
        }
        this.cameras.main.startFollow(this.player.sprite,true,0.25,0.25)
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
        this.time.delayedCall(4000, this.onEnemySpawn, [], this)
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
        for (let i = 0; i < ammoObjects.length; i++) {
            this.createAmmo(ammoObjects[i])
        }
        this.ammoText = this.add.text(32, 32, 'ammo' + this.player.ammo, {
            fontSize: '96px'
        }).setScrollFactor(0)
        this.scoreText = this.add.text(750, 64, 'Jewels: ' + this.collectionTotal, {
            fontSize: '96px'
        }).setScrollFactor(0)
    }
    findPath(point) {
        //point object has x and y in pixels
        let toX = Math.floor(point.x / this.map.tileWidth)
        let toY = Math.floor(point.y / this.map.tileHeight)
        let fromX = Math.floor(this.activeEnemy.sprite.x / this.map.tileWidth)
        let fromY = Math.floor(this.activeEnemy.sprite.y / this.map.tileHeight)
        //console.log('going from' + fromX + '+' + fromY + 'to' + toX + 'and' + toY)
        let callback = this.moveEnemy.bind(this)
        this.finder.findPath(fromX, fromY, toX, toY, function (path) {
            if (path === null) {

            }
            else {

                callback(path)
            }
        })
        //execute
        this.finder.calculate()
    }
    moveEnemy(path) {
        if (this.player.isDead) {
            return
        }
        let tweenList = []
        for (let i = 0; i < path.length - 1; i++) {
            //current pos
            let cx = path[i].x
            let cy = path[i].y
            // target pos
            let dx = path[i + 1].x
            let dy = path[i + 1].y
            //target angle
            let a
            if (dx > cx) {
                a = 0
            } else if (dx < cx) {
                a = 180
            } else if (dy > cy) {
                a = 90
            } else if (dy < cy) {
                a = 270
            }
            //phaser tween
            tweenList.push({
                targets: this.activeEnemy.sprite,
                x: { value: (dx * this.map.tileWidth) + (0.5 * this.map.tileWidth), duration: this.activeEnemy.speed },
                y: { value: (dy * this.map.tileHeight) + (0.5 * this.map.tileHeight), duration: this.activeEnemy.speed },
                angle: { value: a, duration: 0 }
            })
        }
        this.tweens.timeline({
            tweens: tweenList
        })
    }
    onEnemySpawn() {
        let index = Phaser.Math.Between(0, this.enemySpawnPoints.length - 1)
        let spawnPoint = this.enemySpawnPoints[index]
        //console.log('Spawnpoint' + spawnPoint)
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
        enemy.targetX = toX
        enemy.targetY = toY
        this.findPath({ x: toX, y: toY })
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

        let bullet = this.bullets.get(this.player.sprite.x + vector.x, this.player.sprite.y + vector.y)
        if (this.player.ammo >= 1) {
            if (bullet) {
                this.player.ammo -= 1
                //console.log('ammo:' + this.player.ammo)
                bullet.setDepth(4)
                bullet.body.collideWorldBounds = true
                bullet.body.onWorldBounds = true
                bullet.enableBody(false, bullet.x, bullet.y, true, true)
                bullet.rotation = this.player.sprite.rotation
                this.physics.velocityFromRotation(bullet.rotation, 700, bullet.body.velocity)
                for (let i = 0; i < this.enemies.length; i++) {
                    this.physics.add.collider(this.enemies[i].sprite, bullet, this.bulletHitEnemy, null, this)
                }
            }
        }
        this.ammoText.setText('ammo' + this.player.ammo)
    }
    worldBoundsBullet(body) {
        //return bullet to object pool
        body.gameObject.disableBody(true, true)
    }
    bulletHitWall(bullet, layer) {
        bullet.disableBody(true, true)
    }
    bulletHitEnemy(enemySprite, bullet) {
        bullet.disableBody(true, true)
        let index
        for (let i = 0; i < this.enemies.length; i++) {
            if (this.enemies[i].sprite === enemySprite) {
                index = i
                break
            }
        }
        this.enemies.splice(index, 1)
        this.add.image(enemySprite.x, enemySprite.y, 'deadEnemy').setRotation(enemySprite.rotation).setDepth(0)
        enemySprite.destroy()
        if (!this.player.isDead && this.enemies.length < this.minEnemies) {
            this.onEnemySpawn()
        }

    }
    collideEnemy(player, enemySprite) {
        this.tweens.killAll()
        this.physics.pause()
        this.player.isDead = true
        this.player.sprite.setTint(0xFF0000)
    }
    //ammo pick up and creation
    createAmmo(index) {
        let ammoClip
        ammoClip = this.physics.add.image(index.x, index.y, 'ammo')
        this.physics.add.overlap(ammoClip, this.player.sprite, this.ammoPickup, null, this)
    }
    ammoPickup(ammoClip) {
        ammoClip.disableBody(true, true)
        this.player.ammo += 5
        this.ammoText.setText('ammo' + this.player.ammo)
    }
    //collectables pickup
    createCollectable(dataObject) {
        //console.log(dataObject)
        let collectable
        //collectable = new Collectable(this, dataObject.x,dataObject.y,'collectable1')
        collectable = this.physics.add.image(dataObject.x, dataObject.y, 'collectable1')
        this.physics.add.overlap(collectable, this.player.sprite, this.collectPick, null, this)

    }
    collectPick(collectable) {
        collectable.disableBody(true, true)
        let collectableUI
        collectableUI = this.add.image(64, 128, 'collectable1')
        this.collectionTotal += 1
        //console.log(this.collectionTotal)
        this.scoreText.setText('Jewels: ' + this.collectionTotal)

    }
    update(time, delta) {
        this.player.update(time, delta)
        for (let i = 0; i < this.enemies.length; i++) {
            this.enemies[i].update(time, delta)
        }
        if (this.collectionTotal == 2) {
            this.minEnemies = 4
            if (!this.player.isDead && this.enemies.length < this.minEnemies) {
                //console.log(time)
                this.onEnemySpawn()
            }
            this.door.doorMove()
            //if(this.door.)


        }
        if (this.door.sprite.x <= this.doorDestX) {
            console.log('pass')
            this.door.sprite.setVelocityX(0)
        }
    }
}