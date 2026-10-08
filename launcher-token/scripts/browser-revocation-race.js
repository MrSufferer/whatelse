async page => {
 const data = '0x536c16d0000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb9226600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000001a4c6f63616c2074657374207265766f636174696f6e2072616365000000000000';
 await page.exposeFunction('__issue32RevertRpc',async ({method,params=[]})=>{
 const rpc=async(method,params)=>(await page.request.post('http://127.0.0.1:8545',{data:{jsonrpc:'2.0',id:1,method,params}})).json();
 if(method==='eth_sendTransaction') {
 const revoked=await rpc('eth_sendTransaction',[{from:params[0].from,to:params[0].to,data,gas:'0x186a0'}]);if(revoked.error)throw Error(revoked.error.message);
 params[0].gas='0x1e8480';
 }
 return rpc(method,params);
 });
 await page.evaluate(()=>window.__issue32Rpc=window.__issue32RevertRpc);
 await page.getByRole('button',{name:'Create zero-supply token'}).click();
 await page.getByText(/Creation not completed:.*revert/i).waitFor();
 return {url:page.url(),status:await page.locator('.transaction-status').innerText()};
}
