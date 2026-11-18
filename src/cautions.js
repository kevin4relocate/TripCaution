// Global issue-based discovery. Editorial research priorities are separate
// from which countries and topics the publishing platform can represent.
// Every stored category ID belongs to exactly one reader-facing topic.
export const CAUTION_TOPICS=Object.freeze([
 {slug:'scams-theft',title:'Scams & theft',description:'Documented travel scams, pickpocketing and precautions for your exact destination.',ids:['tourist-traps','scams-theft']},
 {slug:'payments-money',title:'Payments & money',description:'Card acceptance, cash-only situations, payment network limits and fees.',ids:['payments-money']},
 {slug:'transport',title:'Transport difficulties',description:'Airport pickup, tickets, unreliable connections and route-specific checks.',ids:['transport']},
 {slug:'laws-customs',title:'Local laws & customs',description:'Rules and cultural differences to verify for your particular trip.',ids:['local-laws','etiquette']},
 {slug:'safety-health',title:'Safety & health',description:'Sourced precautions and situation-specific public health information.',ids:['safety-health']},
 {slug:'travel-essentials',title:'Travel essentials',description:'Connectivity, bookings, food and practical preparation problems.',ids:['travel-essentials','before-you-go','food','things-to-avoid']}
]);
export const cautionTopic=slug=>CAUTION_TOPICS.find(topic=>topic.slug===slug)||null;
export const cautionTopicForCategory=id=>CAUTION_TOPICS.find(topic=>topic.ids.includes(id))||null;
