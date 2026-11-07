(function(root){
const finite=v=>typeof v==='number'&&Number.isFinite(v),median=a=>{const s=a.slice().sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
function evaluate(stock,all){
 if(!stock||!finite(stock.pe)||stock.pe<=0)return {label:'本益比不適用',tone:'neutral',reason:'缺少正本益比；虧損、特殊證券或缺值不判定為低估。',peerCount:0};
 if(!stock.industry||!stock.peDate)return {label:'同業資料不足',tone:'neutral',reason:'缺少產業分類或本益比日期，暫不判估值。',peerCount:0};
 const peers=all.filter(x=>x.code!==stock.code&&x.industry===stock.industry&&x.peDate===stock.peDate&&finite(x.pe)&&x.pe>0);
 if(peers.length<5)return {label:'同業樣本不足',tone:'neutral',reason:'需至少 5 家同產業、同日且正本益比的其他公司。',peerCount:peers.length};
 const mid=median(peers.map(x=>x.pe)),relative=stock.pe/mid;return {label:relative<=.8?'同業相對偏低':relative>=1.2?'同業相對偏高':'同業區間',tone:relative<=.8?'low':relative>=1.2?'high':'neutral',peerCount:peers.length,median:mid,relative,reason:'相對同業本益比'+(relative<=.8?'低至少 20%':relative>=1.2?'高至少 20%':'介於 ±20%')+'；僅為估值線索，需核對盈餘品質、成長與景氣循環，不能等同內在價值。'};
}
function dayTrade(stock){if(!stock||!finite(stock.dayTradeShares)||stock.dayTradeShares<0||!finite(stock.tradingShares)||stock.tradingShares<=0||stock.dayTradeDate!==stock.tradingDate)return null;const value=stock.dayTradeShares/stock.tradingShares*100;return value<=100?value:null;}
function attach(history,stock){return history.map(row=>{const r={...row};if(stock?.marginDate===r.date){if(finite(stock.marginBalance))r.marginBalance=stock.marginBalance;if(finite(stock.marginChange))r.marginChange=stock.marginChange}if(stock?.tradingDate===r.date&&stock?.dayTradeDate===r.date){r.dayTradeRate=dayTrade(stock);r.dayTradeShares=stock.dayTradeShares;r.tradingShares=stock.tradingShares}return r})}
const api={attach,evaluate,dayTrade,median};root.StockValuation=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
