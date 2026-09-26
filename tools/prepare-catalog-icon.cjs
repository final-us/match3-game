'use strict';
// Preserve the generated alpha while reducing the accepted icon for a 44px slot.
const fs=require('fs'),path=require('path');
const {chromium}=require('/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright');
const incoming=path.resolve(__dirname,'../assets/_incoming/cat-catalog-v1');
const target=path.resolve(__dirname,'../match3-wechat/res/home/catalog-album.png');
(async()=>{
    const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
    try {
        const page=await browser.newPage();
        const result=await page.evaluate(async url=>{
            const img=new Image();img.src=url;await img.decode();
            const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
            const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,160,160);
            const pixels=ctx.getImageData(0,0,160,160).data;let clear=0,partial=0;
            for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)clear++;else if(pixels[i]<255)partial++;}
            if(clear<1000)throw new Error('Expected a genuine transparent icon background');
            const png=canvas.toDataURL('image/png').split(',')[1];
            const proof=document.createElement('canvas');proof.width=320;proof.height=160;
            const pc=proof.getContext('2d');pc.fillStyle='#F1E8FA';pc.fillRect(0,0,160,160);pc.fillStyle='#303653';pc.fillRect(160,0,160,160);
            for(const x of [58,218])pc.drawImage(canvas,x,58,44,44);
            return {png,proof:proof.toDataURL('image/png').split(',')[1],source:[img.width,img.height],clear,partial};
        },'data:image/png;base64,'+fs.readFileSync(path.join(incoming,'catalog-icon-v1.png')).toString('base64'));
        fs.writeFileSync(target,Buffer.from(result.png,'base64'));
        fs.writeFileSync(path.join(incoming,'catalog-icon-44px-alpha-proof.png'),Buffer.from(result.proof,'base64'));
        console.log(JSON.stringify({target,source:result.source,width:160,height:160,clear:result.clear,partial:result.partial,bytes:fs.statSync(target).size}));
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
