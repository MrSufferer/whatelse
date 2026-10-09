async page=>{
 await page.exposeFunction('__issue34RaceRpc',async({method,params=[]})=>{
  if(method==='eth_sendTransaction'){
   const mode=await page.evaluate(()=>window.__issue34RaceMode);
   if(mode){
    await page.evaluate(async({mode,tx})=>{
     window.__issue34RaceMode='';
     window.__issue34RaceBaseline=await window.__issue34BeforeSend({mode,tx});
    },{mode,tx:params[0]});
    params=[{...params[0],gas:'0x1e8480'}];
   }
  }
  const response=await page.request.post('http://127.0.0.1:8545',{data:{jsonrpc:'2.0',id:34,method,params}});
  return response.json();
 });
 await page.evaluate(()=>window.__issue32Rpc=window.__issue34RaceRpc);
 return 'Race interceptor installed at wallet RPC bridge boundary';
}
