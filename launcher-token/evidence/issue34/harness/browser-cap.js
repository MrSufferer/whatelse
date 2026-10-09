async page=>{
 const rpc=async(method,params=[])=>{const r=await page.request.post('http://127.0.0.1:8545',{data:{jsonrpc:'2.0',id:34,method,params}});const b=await r.json();if(b.error)throw Error(b.error.message);return b.result;};
 const token='0xa16E02E87b7454126E5E10d957A927A7F5B5d2be', account='0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
 await rpc('evm_mine');
 await page.getByLabel('ETH budget including fees').fill('11');
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='Buy with signed limits').disabled);
 const beforeWallet=BigInt(await rpc('eth_getBalance',[account,'latest']));
 const beforeEth=BigInt(await rpc('eth_getBalance',[token,'latest']));
 const beforeHoldings=BigInt(await rpc('eth_call',[{to:token,data:'0x70a08231'+account.slice(2).padStart(64,'0')},'latest']));
 const text=await page.locator('main').innerText();
 if(!await page.locator('[data-testid="buy-interval"]').count())throw Error('No buy traversal');
 await page.getByLabel('ETH budget including fees').press('Enter');
 await page.getByText(/Buy included in a canonical block/).first().waitFor({timeout:30000});
 const block=await rpc('eth_getBlockByNumber',['latest',true]);const tx=block.transactions.find(x=>x.to?.toLowerCase()===token.toLowerCase());const receipt=await rpc('eth_getTransactionReceipt',[tx.hash]);
 if(receipt.status!=='0x1')throw Error('Buy failed');
 const afterWallet=BigInt(await rpc('eth_getBalance',[account,'latest'])),afterEth=BigInt(await rpc('eth_getBalance',[token,'latest']));
 const supply=BigInt(await rpc('eth_call',[{to:token,data:'0x18160ddd'},'latest']));
 const holdings=BigInt(await rpc('eth_call',[{to:token,data:'0x70a08231'+account.slice(2).padStart(64,'0')},'latest']));
 const gas=BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice),charge=afterEth-beforeEth,refund=11n*10n**18n-charge;
 if(supply!==10n**24n||refund<=0n||beforeWallet-afterWallet!==charge+gas||holdings<=beforeHoldings)throw Error('Cap/refund accounting mismatch');
 await page.getByText('Supply Cap reached. Buying is unavailable.',{exact:true}).waitFor();
 if(await page.getByRole('button',{name:'Buy with signed limits',exact:true}).isEnabled())throw Error('Cap buy enabled');
 const responsive=[];for(const width of [375,768,1280]){await page.setViewportSize({width,height:900});await page.waitForTimeout(150);responsive.push({width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});await page.screenshot({path:`/tmp/pumpfun-issue34/buy-cap-${width}.png`,fullPage:true});}
 if(responsive.some(x=>x.overflow))throw Error('Responsive overflow');
 const result={hash:tx.hash,status:receipt.status,supply:supply.toString(),holdings:holdings.toString(),contractEth:afterEth.toString(),charge:charge.toString(),refund:refund.toString(),gas:gas.toString(),walletDelta:(beforeWallet-afterWallet).toString(),keyboardSubmission:true,capDisabled:true,responsive,quoteText:text};
 await page.evaluate(x=>window.issue34CapResult=x,result);return result;
}
