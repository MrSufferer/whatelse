// playwright-cli run-code function. Fresh approved local-fixture deployment and installed browser-wallet.js required.
async page => {
  await page.goto('http://localhost:3000/create');
  await page.getByRole('button', {name:'Connect Wallet', exact:true}).click();
  await page.getByRole('button', {name:'Local Anvil', exact:true}).click();
  await page.getByText('Approved proposal matches your wallet and form.').waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.__issue32Wallet.setChain('0x1'));
  await page.getByText(/Network mismatch/).waitFor();
  if(!await page.getByRole('button',{name:'Create zero-supply token'}).isDisabled())throw Error('wrong-chain write enabled');
  await page.evaluate(()=>window.__issue32Wallet.setChain('0x7a69'));
  await page.getByText('Approved proposal matches your wallet and form.').waitFor();
  await page.evaluate(()=>window.__issue32Wallet.rejectNextTransaction());
  await page.getByRole('button',{name:'Create zero-supply token'}).click();
  await page.getByText(/Creation not completed:/).waitFor();
  if(!page.url().endsWith('/create'))throw Error('cancelled creation navigated');
  if(await page.getByLabel('Token name').inputValue()!=='Fictional Test Launcher')throw Error('cancellation lost form');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('mobile overflow');
  await page.getByLabel('Symbol',{exact:true}).focus();
  for(let i=0;i<8;i++){
    if(await page.evaluate(()=>document.activeElement.textContent==='Create zero-supply token'))break;
    await page.keyboard.press('Tab');
  }
  if(!await page.evaluate(()=>document.activeElement.textContent==='Create zero-supply token'))throw Error('keyboard cannot reach submit');
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/token\/31337\//);
  await page.getByRole('heading',{name:'Fictional Test Launcher',exact:true}).waitFor();
  await page.getByText(/Creation finalized|Included in a canonical|Included provisionally/).waitFor();
  const createdUrl=page.url();
  await page.goto(createdUrl.split('?')[0]);
  await page.getByText('Creation receipt unavailable. Registry membership alone does not verify transaction finality.').waitFor();
  if(await page.getByText('Creation block:',{exact:false}).count())throw Error('stale receipt identity');
  for(const width of [375,768,1280]){
    await page.setViewportSize({width,height:900});
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`overflow at ${width}`);
  }
  return {createdUrl,networkMismatchBlocked:true,cancellationRecovered:true,keyboardCreation:true,canonicalDetail:true,receiptReset:true,responsiveWidths:[375,768,1280]};
}
