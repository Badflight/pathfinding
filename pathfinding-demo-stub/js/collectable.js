class Collectable{
    /**@type {Phaser.Scene} */
    scene
    /**@type {Phaser.Physics.Arcade.Sprite} */
    collectable
    /**@type {boolean} */
    collected = false
    constructor(scene,x,y,texture){
        this.scene = scene
        this.scene.physics.add.sprite(x,y,texture)
    }

}