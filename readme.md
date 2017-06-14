[[DEMO]](http://me.jonathanlurie.fr/SegmentDraw/examples)  
[[DOC]](http://me.jonathanlurie.fr/SegmentDraw/doc)  

## Instanciation

```javascript
// basic setup
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.01, 500 );
var controls = new THREE.OrbitControls( camera, renderer.domElement );

// creating a container for our objects
var container = new THREE.Object3D();
// fill this container with other objects
...
var segmentDraw = new SegmentDraw.SegmentDraw( container, scene, camera, {controls: controls} );
```

## Events
Three kinds of events are available:
- `startInteraction` when the key to start drawing the segment is pressed (and hold)
- `stopInteraction` when the key to start drawing the segment is released
- `draw` when drawing the segment, called at every little moves

Events are defined with the method `.on(...)`.    

**Examples**  
```javascript
// No arguments to 'startInteraction'
segmentDraw.on( "startInteraction", function(){
  console.log( "Interaction is starting :)" );
})

// No arguments to 'stopInteraction'
segmentDraw.on( "stopInteraction", function(){
  console.log( "Interaction is over :(" );
})

// the event 'draw' is called with the first and last point of the segment, as THREE.Vector3
segmentDraw.on( "draw", function( begin, end){
  console.log( "------------------" );
  console.log( begin );
  console.log( end );
})
```

**Note:** each event can have multiple callbacks, they will be called in the order they are defined.


## Methods
- `.setBoundingBox( bb )` to restrict the segment to a specific box (world). Where `bb` is a `THREE.Box3`
- `.hide()` to hide the segment once it's drawn
- `.enable( b )` where `b` is a `Boolean`. Disable this instance of `SegmentDraw` when `b` is `false`
