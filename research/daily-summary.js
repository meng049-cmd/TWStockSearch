'use strict';
(function(root){
 const valid=v=>typeof v==='number'&&Number.isFinite(v);
 const number=(v,n=0)=>v.toLocaleString('zh-TW',{maximumFractionDigits:n,minimumFractionDigits:n});
 function conclude(row,previous,kind='stock'){
  const change=valid(row.change)?row.change:null,foreign=valid(row.foreign)?row.foreign:null,margin=valid(row.margin)?row.margin:null;
  const volume=valid(row.volume)&&row.volume>=0?row.volume:null;
  const previousVolume=previous&&valid(previous.volume)&&previous.volume>0?previous.volume:null;
  const volumeChange=volume!==null&&previousVolume!==null?(volume/previousVolume-1)*100:null;
  const price=change===null?'漲跌待核對':change>0?'收高':change<0?'收低':'平盤';
  const volumeLabel=volumeChange===null?'量能待比較':volumeChange>0?'量增':volumeChange<0?'量縮':'量持平';
  const unit=kind==='future'?'口':'張';
  const facts=[
   {label:'收盤走勢',text:valid(row.close)?`${number(row.close,2)}${change===null?'，缺前收盤，無法比較漲跌':`，較前日 ${change>0?'+':''}${number(change,2)}%`}`:'缺少收盤資料'},
   {label:'成交量',text:volume===null?'尚未取得':`${number(volume)} ${unit}；${volumeChange===null?'缺有效前日量，無法比較':`較前日${volumeChange>0?'增加':volumeChange<0?'減少':'持平'} ${number(Math.abs(volumeChange),2)}%`}${valid(row.ratio)?`；前五日均量 ${number(row.ratio,2)} 倍`:'；前五日量比資料不足'}`},
   {label:'外資',text:foreign===null?'尚未取得，不當作零':`${foreign>0?'淨買超':foreign<0?'淨賣超':'買賣平衡'} ${number(Math.abs(foreign))} ${unit}`},
   {label:'融資',text:kind==='future'?'期貨不適用現股融資':margin===null?'尚未取得，不當作零':`餘額${margin>0?'增加':margin<0?'減少':'不變'} ${number(Math.abs(margin))} 張`}
  ];
  let relation;
  if(change===null)relation='缺少前一筆收盤，無法形成完整的當日漲跌解讀。';
  else if(kind==='future')relation=`當日${price}${volumeLabel}；現股融資不適用期貨${foreign===null?'，外資資料也尚未取得':''}，結論限於已取得的價格與量能。`;
  else if(foreign===null||margin===null)relation=`當日${price}${volumeLabel}，但${[foreign===null?'外資':null,margin===null?'融資':null].filter(Boolean).join('與')}資料不足，無法完成四項交叉判讀。`;
  else if(change>0)relation=(foreign>0?'收高與外資淨買超方向一致':foreign<0?'外資淨賣超下仍收高，外資方向與價格背離':'收高但外資買賣平衡')+(margin>0?'，同時融資增加，當日上漲伴隨槓桿部位擴張。':margin<0?'，融資反而減少，當日上漲未伴隨融資擴張。':'，融資餘額持平。');
  else if(change<0)relation=(foreign<0?'收低與外資淨賣超方向一致':foreign>0?'外資淨買超仍未伴隨收高，當日價格與外資方向背離':'外資買賣平衡，但價格仍收低')+(margin>0?'，融資卻增加，呈現價跌與槓桿部位擴張並存。':margin<0?'，融資同步減少，呈現價格走低與融資部位收縮並存。':'，融資餘額持平。');
  else relation=`收盤與前日相同；外資${foreign>0?'淨買超':foreign<0?'淨賣超':'買賣平衡'}、融資${margin>0?'增加':margin<0?'減少':'持平'}，籌碼變動未伴隨收盤價改變。`;
  const volumeReading=volumeChange===null?'缺少有效前日量，不判定量增或量縮。':volumeChange>0?`成交量較前日增加，當日交易參與程度提高${change<0?'，並伴隨收低':change>0?'，並伴隨收高':''}。`:volumeChange<0?`成交量較前日減少，當日交易參與程度降低${change<0?'；量縮下跌不能單憑量縮判定止跌':change>0?'；價格收高但當日成交量未同步增加':''}。`:'成交量與前日相同。';
  return {title:`${price}${volumeLabel}`,facts,conclusion:relation+' '+volumeReading,classification:change===null||kind==='future'||foreign===null||margin===null?'neutral':change<0&&foreign<0&&margin>0?'risk':change>0&&foreign>0&&margin<0?'up':'neutral'};
 }
 root.TurningDaily={conclude};
})(globalThis);
