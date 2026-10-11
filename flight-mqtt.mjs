import {BROKERS,topics,makeReceiver,quaternionFields,PROTOCOL_VERSION} from './flight-core.mjs?v=1011-q2';

// Every pose crosses an actual WebSocket MQTT broker; no browser-local bus.
export function connectFlight({room,broker='emqx',role,onState=()=>{},onPose=()=>{},onLatency=()=>{},mqttLib=globalThis.mqtt}) {
  if(!mqttLib?.connect)throw new Error('MQTT를 불러오지 못했습니다. 새로고침해 주세요.');
  const channel=topics(room),receiver=makeReceiver(),device=`${role}-${crypto.randomUUID().slice(0,18)}`;
  let ready=false,ended=false,seq=0,pingTimer=null;const probes=new Map();
  const client=mqttLib.connect(BROKERS[broker].url,{clientId:`flight-${device}`,clean:true,keepalive:20,reconnectPeriod:2000,connectTimeout:9000,queueQoSZero:false,resubscribe:false});
  function state(value){ready=value==='connected';if(!ended)onState(value);}
  function clearProbes(){clearInterval(pingTimer);pingTimer=null;probes.clear();onLatency(null);}
  client.on('connect',()=>{
    if(ended)return;state('subscribing');
    client.subscribe(role==='viewer'?[channel.pose,channel.pong]:[channel.ping],{qos:0},(err,granted)=>{
      if(ended||!client.connected)return;
      if(err||!granted?.length||granted.some(g=>g.qos===128)){state('error');return;}
      state('connected');clearProbes();
      if(role==='viewer')pingTimer=setInterval(()=>{
        if(!ready||!client.connected)return;
        const id=crypto.randomUUID();probes.set(id,performance.now());
        for(const [k,t] of probes)if(performance.now()-t>5000)probes.delete(k);
        client.publish(channel.ping,JSON.stringify({id}),{qos:0,retain:false});
      },2000);
    });
  });
  client.on('message',(topic,bytes,packet)=>{
    if(ended||!ready||packet?.retain)return;
    const raw=bytes.toString();if(raw.length>1600)return;
    if(role==='viewer'&&topic===channel.pose){const pose=receiver.accept(raw);if(pose)onPose(pose);}
    else if(topic===(role==='viewer'?channel.pong:channel.ping)){
      let d;try{d=JSON.parse(raw);}catch{return;}
      if(typeof d?.id!=='string'||!/^[a-f0-9-]{36}$/.test(d.id))return;
      if(role==='sender')client.publish(channel.pong,JSON.stringify({id:d.id}),{qos:0,retain:false});
      else if(probes.has(d.id)){onLatency(Math.round(performance.now()-probes.get(d.id)));probes.delete(d.id);}
    }
  });
  for(const event of ['offline','close','reconnect'])client.on(event,()=>{clearProbes();state('reconnecting');});
  client.on('error',()=>state('error'));onState('connecting');
  return {
    get ready(){return ready&&client.connected&&!ended;},get topic(){return channel.pose;},
    send(quaternion,source='sensor'){
      if(role!=='sender'||!ready||!client.connected||ended)return false;
      const fields=quaternionFields(quaternion);if(!fields)return false;
      const message={v:PROTOCOL_VERSION,...fields,source:source==='sensor'?'sensor':'manual',device,seq:++seq,t:Date.now()};
      client.publish(channel.pose,JSON.stringify(message),{qos:0,retain:false});return message;
    },
    close(){ended=true;ready=false;clearProbes();client.end(true);}
  };
}
