(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.SegmentDraw = global.SegmentDraw || {})));
}(this, (function (exports) { 'use strict';

/*
* Author   Jonathan Lurie - http://me.jonahanlurie.fr
* License  MIT
* Link      https://github.com/jonathanlurie/PlaneDrag
* Lab       MCIN - Montreal Neurological Institute
*/


// the jacky way to get THREE from a browser or npm
var TROIS = null;

/**
* SegmentDraw is a helper to draw a segment on a THREE.Object3D using the mouse pointer.
* The first and last point are on the surface of the container given in argument to the constructor
*/
class SegmentDraw {

  /**
  * @param {THREE.Object3D} container - an object that contains 3 orthogonal planes
  * @param {THREE.Scene} scene - scene to add the segment to
  * @param {THREE.Camera} camera - camera
  * @param {Object} options - {mouse: THREE.Vector2, control: THREE.OrbitControl, drawKey: String, ,hideKey: String, segmentThickness: Number, segmentColor: String}.
  * Default values: drawKey="Space", hideKey="Escape", segmentThickness=6, segmentColor="#6600aa"
  */
  constructor( container, scene, camera, options = {}){
    this._requireThree();

    this._enabled = true;

    // contains the three planes
    this._container = container;

    // camera we use to cast rays
    this._camera = camera;

    // the main scene, where to draw the segment
    this._scene = scene;

    // to restrict the raycasting
    this._boundingBox = new TROIS.Box3( new TROIS.Vector3(-Infinity, -Infinity, -Infinity), new TROIS.Vector3(Infinity, Infinity, Infinity));

    // orbit control or trackball control
    this._controls = this._getOption(options, "controls", null);

    // the mouse coord can be passed by an extenal pointer
    this._mouse = this._getOption(options, "mouse", new TROIS.Vector2(Infinity, Infinity));
    this._useReferenceMouse = !!(options.mouse);

    // 3D position (world) of the clicking
    this._pointClicked3D = null;

    // to cast rays
    this._raycaster = new TROIS.Raycaster();

    // the keyboard key to hold for drawing
    this._drawKey = this._getOption(options, "drawKey", "Space");
    this._hideKey = this._getOption(options, "hideKey", "Escape");

    // segment properties
    this._radius = this._getOption(options, "radius", 0.5);
    this._segmentThickness = this._getOption(options, "segmentThickness", 6);
    this._segmentColor = this._getOption(options, "segmentColor", "#6600aa");

    this._mouseDown = false;

    this._sampleSegment = {
      segment: null,
      started: false
    };

    this._orbitData = {};

    this._drawModeEnabled = false;

    // all the following are array of events
    this._customEvents = {
      startInteraction: [],
      stopInteraction: [],
      draw: [],
    };

    this._initSamplingSegment();
    this._initEvents();
  }


  /**
  * [PRIVATE]
  * Init the segment object with size 0 and invisible
  */
  _initSamplingSegment(){
    var material = new TROIS.LineBasicMaterial({
      color: this._segmentColor,
      linewidth: this._segmentThickness,
      linecap: "square"
    });


    var path = new TROIS.LineCurve(
      new TROIS.Vector3( 0, 0, 0 ),
      new TROIS.Vector3( 0, 0, 0 )
    );
    var params = [path, 10, this._radius, 8, false];
    var geometry = new TROIS.TubeBufferGeometry(...params);
    this._sampleSegment = {
      params: params,
      segment: new TROIS.Mesh( geometry, material ),
      started: false
    };

    this._sampleSegment.segment.name = "sampling_segment";
    this._sampleSegment.segment.visible = false;
    this._scene.add( this._sampleSegment.segment );
  }


  /**
  * [PRIVATE]
  * Hacky way to make sure THREE is around, from with a browser or a npm package
  */
  _requireThree(){
    try {
      TROIS = (window && window.THREE) || require('three');
    } catch(e) {
      // here, window.THREE does not exist (or not yet)

      // trying to require
      try {
        TROIS = require("three");
      } catch (e) {
        // here, require is not possible (we are certainly in a browser)
        console.error( e );
      }
    }
  }


  /**
  * [PRIVATE]
  * get a value from the option argument in the constructor
  */
  _getOption(optionsObject, key, defaultValue){
    if(!optionsObject)
      return defaultValue;

    return optionsObject[ key ] || defaultValue;
  }


  /**
  * [PRIVATE]
  * Initialize all the mouse/keyboard events
  */
  _initEvents(){
    window.addEventListener( 'mousemove', this._onMouseMove.bind(this), false );
    window.addEventListener( 'mousedown', this._onMouseDown.bind(this), false );
    window.addEventListener( 'mouseup', this._onMouseUp.bind(this), false );
    window.addEventListener( 'keyup', this._onKeyUp.bind(this), false );
    window.addEventListener( 'keydown', this._onKeyDown.bind(this), false );
  }


  /**
  * [PRIVATE - EVENT]
  * when mouse is moving, refreshes the internal normalized mouse position
  */
  _onMouseMove( evt ){
    if( !this._enabled )
      return;

    // do not recompute the unit mouse coord if we use an external mouse reference
    if(!this._useReferenceMouse){
      this._mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
      this._mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    }

    if( this._sampleSegment.started ){
      this._continueSegment( this._raycast() );
    }
  }


  /**
  * [PRIVATE - EVENT]
  * when mouse is clicked, cast a ray if the right keyboard key is maintained pushed
  */
  _onMouseDown( evt ){
    if( !this._enabled )
      return;

    this._mouseDown = true;

    if( this._drawModeEnabled ){
      this._startSegment( this._raycast() );
    }
  }

  /**
  * [PRIVATE]
  * generate the tube geometry of the line segment.
  */
  _makeTubeGeometry() {
    this._sampleSegment.segment.geometry =
      new TROIS.TubeBufferGeometry(...this._sampleSegment.params);
  }
  
  /**
  * [PRIVATE]
  * Start the segment drawing with a given point
  * @param {THREE.Vector3} point - most likely given by a raycaster
  */
  _startSegment( point ){
    if( !point )
      return

    var DELTA = new TROIS.Vector3(0.01, 0.01, 0.01);
    this._sampleSegment.started = true;
    this._sampleSegment.params[0].v1.copy( point );
    this._sampleSegment.params[0].v2.addVectors(point, DELTA);
    this._makeTubeGeometry();
    this._sampleSegment.segment.visible = true;
  }

  /**
  * Edit the last point of the segment
  * @param {THREE.Vector3} point - most likely given by a raycaster
  */
  _continueSegment( point ){
    if( !point )
      return;
    this._sampleSegment.params[0].v2.copy( point );
    this._makeTubeGeometry();
    this._triggerEvents( "draw", [
      this._sampleSegment.params[0].v1.clone(),
      this._sampleSegment.params[0].v2.clone()
    ]);
  }

  /**
   * Draw a line segment between two given points.
   * @param  {THREE.Vector3} start
   * @param  {THREE.Vector3} end
   */
  drawSegment(begin, end) {
    this._sampleSegment.params[0].v1.copy( begin );
    this._sampleSegment.params[0].v2.copy( end );
    this._makeTubeGeometry();
    this._sampleSegment.segment.visible = true;
    this._triggerEvents( "draw", [
      this._sampleSegment.params[0].v1.clone(),
      this._sampleSegment.params[0].v2.clone()
    ]);
  }
  /**
  * [PRIVATE - EVENT]
  * when mouse is releasing
  */
  _onMouseUp( evt ){
    if( !this._enabled )
      return;

    this._mouseDown = false;
    this._sampleSegment.started = false;
  }


  /**
  * [PRIVATE - EVENT]
  * when a key from the keyboard is pressed. Refreshes the current state
  */
  _onKeyUp( evt ){
    if( !this._enabled )
      return;

    switch (evt.code) {
      case this._drawKey:
        this._drawModeEnabled = false;
        this._sampleSegment.started = false;
        this._enableControl();
        this._triggerEvents( "stopInteraction" );
        break;

      case this._hideKey:
        this.hide();
        break;

      default:
    }
  }


  /**
  * [PRIVATE - EVENT]
  * when a key from the keyboard is released. Refreshes the current state
  */
  _onKeyDown( evt ){
    if( !this._enabled )
      return;

    if( evt.code === this._drawKey && !this._drawModeEnabled){
      this._drawModeEnabled = true;
      this._disableControl();
      this._triggerEvents( "startInteraction" );
    }
  }


  /**
  * Define a boundingbox to restrict the raycasting and the shift
  * @param {TROIS.Box3} b - bounding box
  */
  setBoundingBox( b ){
    this._boundingBox = b.clone();
  }


  /**
  * Hide the segment (does NOT remove it)
  */
  hide(){
    this._sampleSegment.segment.visible = false;
  }


  /**
  * [PRIVATE]
  * Performs a raycasting on the children of the plane container, then based on the
  * active state, take a decision of what to do.
  */
  _raycast(){
    this._raycaster.setFromCamera( this._mouse, this._camera );
    var intersects = this._raycaster.intersectObject( this._container, true );

    for(var i=0; i<intersects.length; i++){
      if( this._boundingBox.containsPoint( intersects[i].point) ){
        return intersects[i].point;
      }
    }

    return null;
  }


  /**
  * [PRIVATE]
  * Disable the orbit/trackball control
  */
  _disableControl(){
    if(!this._controls)
      return;

    if(this._controls.enabled){
      this._saveOrbitData();
    }

    this._controls.enabled = false;
  }


  /**
  * [PRIVATE]
  * enable the orbit/trackball control
  */
  _enableControl(){
    if(!this._controls)
      return;

    // if already enables
    if( this._controls.enabled )
      return;

    this._controls.enabled = true;
    this._restoreOrbitData();
  }


  /**
  * [PRIVATE]
  * Helper method to call before disabling the controls
  */
  _saveOrbitData(){
    this._orbitData = {
      target: new TROIS.Vector3(),
      position: new TROIS.Vector3(),
      zoom: this._controls.object.zoom
    };

    this._orbitData.target.copy(this._controls.target);
    this._orbitData.position.copy(this._controls.object.position);
  }


  /**
  * [PRIVATE]
  * Helper method to call before re-enabling the controls
  */
  _restoreOrbitData(){
    this._controls.position0.copy(this._orbitData.position);
    this._controls.target0.copy(this._orbitData.target);
    this._controls.zoom0 = this._orbitData.zoom;
    this._controls.reset();
  }


  /**
  * Enable or disable the SegmentDraw instance
  * @param {Boolean} bool - true: enable, false: disable
  */
  enable( bool ){
    this._enabled = bool;
  }


  /**
  * specify an event
  */
  on( eventName, callback ){
    if(typeof(callback) === 'function'){
      if( eventName in this._customEvents ){
        this._customEvents[ eventName ].push( callback );
      }
    }
  }


  /**
  * Call a registered event
  * @param {String} eventName - name of the event
  * @param {Array} args - array of argument to be transmited to the callback
  */
  _triggerEvents( eventName, args=null ){
    if( eventName in this._customEvents ){
      var events = this._customEvents[eventName];

      for(var i=0; i<events.length; i++){
        events[i].apply(null, args);
      }
    }
  }

} /* END of class SegmentDraw */

exports.SegmentDraw = SegmentDraw;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=SegmentDraw.js.map
