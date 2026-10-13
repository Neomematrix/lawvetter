export const reviewRatingCategories=[
 {key:'rating_use_again',label:'Would use again?'},
 {key:'rating_cared_for',label:'Feel cared for?'},
 {key:'rating_rights',label:'Defended my rights?'},
 {key:'rating_outcome',label:'Pleased with the outcome?'},
] as const;
export type ReviewRatings=Record<typeof reviewRatingCategories[number]['key'],number|null>;
