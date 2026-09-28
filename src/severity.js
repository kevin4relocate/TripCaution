// Severity describes the potential impact of one narrowly scoped situation if
// it occurs. It is NOT a probability estimate or a country/people safety score.
// New AI imports and pre-Sprint-5 content are always unassessed until reviewed.
export const CAUTION_LEVELS=Object.freeze([
 {id:'unassessed',label:'Not assessed',short:'Not assessed',description:'No editor-assessed impact level is available.'},
 {id:'low',label:'Low impact',short:'Low',description:'A limited inconvenience with a straightforward alternative.'},
 {id:'moderate',label:'Moderate impact',short:'Moderate',description:'May significantly disrupt plans, cost money or require extra preparation.'},
 {id:'high',label:'High impact',short:'High',description:'Potential for serious financial loss, major disruption or personal harm in the described situation.'},
 {id:'critical',label:'Critical impact',short:'Critical',description:'Potential for life-threatening harm, severe injury or an exceptionally serious consequence in the described situation.'}
]);
export const cautionLevel=id=>CAUTION_LEVELS.find(level=>level.id===id)||CAUTION_LEVELS[0];
export const isRatedCaution=id=>CAUTION_LEVELS.some(level=>level.id===id&&id!=='unassessed');
export const severeCaution=id=>id==='high'||id==='critical';
