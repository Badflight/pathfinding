class Door{
    /**@type {Phaser.Scene} */
    scene
    /**@type {Phaser.Physics.Arcade.Sprite} */
    sprite
    constructor(scene,x,y,texture){
        this.scene = scene
        this.sprite = scene.physics.add.sprite(x,y,texture)
    }
}