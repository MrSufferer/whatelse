async page=>{
 const rpc=async(method,params=[])=>{
  const response=await page.request.post('http://127.0.0.1:8545',{data:{jsonrpc:'2.0',id:34,method,params}});
  const body=await response.json();if(body.error)throw Error(body.error.message);return body.result;
 };
 const token='0xa16E02E87b7454126E5E10d957A927A7F5B5d2be';
 const buy=page.getByRole('button',{name:'Buy with signed limits',exact:true});
 const results=[];
 for(const mode of ['minimum','deadline']){
  await rpc('evm_mine');
  await page.getByRole('button',{name:'Refresh quote and balances',exact:true}).click();
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='Buy with signed limits').disabled);
  await page.evaluate(mode=>{window.__issue34RaceMode=mode;},mode);
  const beforeCount=await page.evaluate(()=>window.__issue32Wallet.state.requests.filter(x=>x.method==='eth_sendTransaction').length);
  await buy.click();
  await page.waitForFunction(n=>window.__issue32Wallet.state.requests.filter(x=>x.method==='eth_sendTransaction').length>n,beforeCount);
  await page.getByText(/Purchase unsuccessful:/).first().waitFor();
  const baseline=await page.evaluate(()=>window.__issue34RaceBaseline);
  const txs=await rpc('eth_getBlockByNumber',['latest',true]);
  const own=txs.transactions.find(tx=>tx.to.toLowerCase()===token.toLowerCase());
  const receipt=await rpc('eth_getTransactionReceipt',[own.hash]);
  if(receipt.status!=='0x0')throw Error(`${mode} race did not actually revert`);
  const supply=await rpc('eth_call',[{to:token,data:'0x18160ddd'},'latest']);
  const eth=await rpc('eth_getBalance',[token,'latest']);
  if(supply!==baseline.supply||eth!==baseline.eth)throw Error(`${mode} revert altered supply or ETH`);
  results.push({mode,hash:own.hash,status:receipt.status,block:receipt.blockNumber,baseline,supplyAndEthUnchanged:true});
 }
 await page.evaluate(result=>window.issue34RaceResult=result,results);
 return results;
}
