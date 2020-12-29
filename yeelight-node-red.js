// https://www.yeelight.com/download/Yeelight_Inter-Operation_Spec.pdf
module.exports = function( RED ) {
  'use strict';
  const { Yeelight } = require( 'yeelight-node' );
  // const { Client } = require('../lib')
  function yeelight_lights( n ) {
    RED.nodes.createNode( this, n );
    this.name = n.name;
    this.ip = n.ip;
    this.port = n.port;
  }
  RED.nodes.registerType( 'yeelight-node-red-lights', yeelight_lights, {
    credentials: {
      name: { type: 'text' },
      ip: { type: 'text' },
      port: { type: 'text' }
    }
  } );

  function YeelightNodeRed( n ) {
    RED.nodes.createNode( this, n );
    this.lights = RED.nodes.getCredentials( n.lights );
    if( this.lights ) {
      if( !this.lights.name ) { throw 'No yeelight name'; }
      if( !this.lights.ip ) { throw 'No yeelight IP address'; }
      if( !this.lights.port ) { this.lights.port = 55443 }
    } else {
      throw 'No yeelight light configuration';
    }
    var node = this;
    const lamp = new Yeelight( { ip: this.lights.ip, port: this.lights.port } );
    lamp.status = {
      name: undefined,
      power:  undefined,
      brightness: null,
      effect: 'smooth',
      duration: 500,
      mode: null,
      temperature: 1700, //1700-6500
    }
    const modes = {
        color: 1,
        temperature: 2,
        hsv: 3,
    }


     const getPropertie = ( propertie ) => {
      return new Promise( async function( resolve, reject ) {
        let results = JSON.parse(  await lamp.get_prop( propertie ) );
        try{
          resolve( results.result[ 0 ] );  
      }catch(e){
        node.error(`failed to getPropertie: ${e}`);
        reject(e);
      }
        
      } );
    }


      const get_lamp_status = async () => {
        lamp.status.power = await getPropertie( 'power' )=='On'?true:false;
        lamp.status.brightness = parseInt(await getPropertie( 'bright' ));
        lamp.status.mode = parseInt(await getPropertie( 'color_mode' ),10);
        lamp.status.temperature = parseInt(await getPropertie( 'ct' ));
        lamp.status.flow = await getPropertie( 'flow_params' );

        lamp.status.color = await getPropertie( 'rgb' );
        lamp.status.hue = await getPropertie( 'hue' );
        lamp.status.sat = await getPropertie( 'saturation' );

        
    }
    // const set_lamp_status = () => {
    //     console.log('set_lamp_status');
    //     console.log(lamp.status, lamp.set);

    //     if(lamp.set.power !== lamp.status.power){
    //         console.log('power: ', lamp.status.power, lamp.set.power);
    //     }

    //     if(lamp.set.brightness !== lamp.status.brightness){
    //         console.log('brightness: ', lamp.status.brightness, lamp.set.brightness);
    //     }

    // }


    (async function init(){
        await get_lamp_status();
        lamp.set = lamp.status;
        lamp.status.name = await getPropertie( 'name' );
        console.log(lamp.status);

        // setInterval(()=>{
        //    get_lamp_status();
        // }, 10000)
    })();

   



    this.on( 'close', function() {
      // tidy up any state
      lamp.closeConnection();
    } );
    this.on( 'input', async function( msg ) {
      if( !msg.payload ) {
        throw 'Yeelight error: payload has no string';
      } else if( typeof( msg.payload ) == 'object' ) {
        // msg.payload = JSON.stringify(msg.payload);
      }
      if( msg.payload.method ) {
        let method = msg.payload.method || '';
        let params = msg.payload.params || [];
        switch ( msg.payload.method ) {
            case 'get':
              {
                await get_lamp_status();
               node.warn(lamp.status);
                break;
              };

          case 'toggle':
            {
              lamp.toggle();
              break;
            };
            /**
             * This method is used to switch the Smart LED on or off at the software level
             * @param {String} power Either the string 'on' or 'off'
             * @param {String} effect Either the string 'sudden' or 'smooth'
             * @param {Number} duration The duration in ms for the transition to occur
             * @param {Number} mode 0 = normal, 1 = CT mode, 2 = RGB mode, 3 = HSV mode, 4 = CF mode, 5 = Night mode
             */
          case 'set_power':
            {
              lamp.set_power( params[ 0 ], params[ 1 ] || lamp.status.effect, params[ 2 ] || lamp.status.duration, params[ 3 ] || 0 );
              break;
            };
            /**
             * This method is used to set the smart LED directly to specified state. If the smart LED is off, then it will turn on the smart LED firstly and then apply the specified command.
             * @param {String} action The type of action being performed
             * @param {*} args Parameters to be passed depedning on the chosen action
             */
          case 'set_scene':
            {
              // if(params[0] == 'color')
              //     params[2]||lamp.status.brightness;
              let params2
              if( params[ 0 ] == 'color' || params[ 0 ] == 'ct' ) {
                params2 = params[ 2 ] || lamp.status.brightness
              } else {
                params2 = params[ 2 ] || 0;
              }

      if(params.length === 2 || params.length === 3){
              lamp.set_scene( params[ 0 ], params[ 1 ], params2);
          }else if(params.length === 4){
            lamp.set_scene( params[ 0 ], params[ 1 ], params2, params[3] );
        }
              break;
         
            };
            /**
             * This method is used to change the brightness of the Smart LED
             * @param {Number} brightness The desired brightness between 1 and 100
             * @param {String} effect Either the string 'sudden' or 'smooth'
             * @param {Number} duration the time in ms for the transition to take effect
             */
          case 'set_bright':
            {
              lamp.status.brightness = params[ 0 ];
              params[ 1 ] ? lamp.status.effect = params[ 1 ] : null;
              params[ 2 ] ? lamp.status.duration = params[ 2 ] : null;
              lamp.set_bright( params[ 0 ], params[ 1 ], params[ 2 ] );
              break;
            };
            /**
             *
             * @param {Number} count The number of state changes before color flow stops. 0 = infinite
             * @param {Number} action The action after stopping CF. 0 = revert to previous state, 1 stay at state when stopped, 2 = turn off smart LED
             * @param {Array} flow A series of tuples defining the [duration, mode, value, brightness]
             */
          case 'start_cf':
            {
              lamp.start_cf( params[ 0 ], params[ 1 ], params[ 2 ] );
              break;
            };
            /**
             * This method is used to stop a running color flow
             */
          case 'stop_cf':
            {
              lamp.stop_cf();
              break;
            };

            case 'Brightness':{
                lamp.set_bright( params[ 0 ], params[ 1 ], params[ 2 ] );
                break;
            }
        }
      }
     
    } );
  }
  RED.nodes.registerType( 'yeelight', YeelightNodeRed );
};
