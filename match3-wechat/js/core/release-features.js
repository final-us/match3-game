'use strict';
// Production-capable clients. Deploy the matching battle service before uploading.
function enabled(api) {
    try { return ['develop','trial','release'].includes(api.getAccountInfoSync().miniProgram.envVersion); }
    catch(error) { return false; }
}
module.exports={enabled};
