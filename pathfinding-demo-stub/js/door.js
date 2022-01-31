class Door {
    /**@type {Phaser.Scene} */
    scene
    /**@type {Phaser.Physics.Arcade.Sprite} */
    sprite
    constructor(scene, x, y, texture) {
        this.scene = scene
        this.sprite = scene.physics.add.sprite(x, y, texture)
    }
    doorDest(x,y){
        this.doorDestX = x
        this.doorDestY = y
        console.log(this.doorDestX)
    }
    doorMove(){
        this.sprite.setVelocityX(-100)
        // if (this.sprite.x === this.doorDestX){
        //     this.sprite.setVelocityX(0)
        // }
    }
}
