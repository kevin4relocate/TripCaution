// Global caution taxonomy is independent of the regional editorial rollout.
// Legacy article category IDs remain readable without rewriting live D1 records.
export const CAUTION_GROUPS=Object.freeze([
 {id:'scams-theft',label:'Scams & theft',description:'Reported scams, pickpocketing, deceptive offers and ways to verify a situation.',categories:['scams-theft','tourist-traps','things-to-avoid']},
 {id:'payments-money',label:'Payments & money',description:'Card acceptance, local payment networks, cash-only situations, currency and fees.',categories:['payments-money']},
 {id:'transport-difficulties',label:'Transport difficulties',description:'Ticket restrictions, airport transfers, service disruptions and transport payment limits.',categories:['transport-difficulties','transport']},
 {id:'laws-customs',label:'Local laws & customs',description:'Rules, etiquette and context-specific misunderstandings that visitors should check.',categories:['laws-customs','local-laws','etiquette']},
 {id:'safety-health',label:'Safety & health',description:'Evidence-backed personal safety, public-health and environmental precautions.',categories:['safety-health']},
 {id:'travel-essentials',label:'Travel essentials',description:'Connectivity, accommodation, entry preparation and practical day-to-day difficulties.',categories:['travel-essentials','before-you-go','food']}
]);
export const CAUTION_CATEGORY_IDS=Object.freeze(CAUTION_GROUPS.map(group=>group.id));
export const cautionGroup=id=>CAUTION_GROUPS.find(group=>group.id===id)||null;
export const cautionGroupForArticle=category=>CAUTION_GROUPS.find(group=>group.categories.includes(category))||null;
