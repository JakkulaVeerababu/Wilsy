// Open-source programs: the listing at /open-source-programs and one page per program. The markup is
// shared with the other hand-curated sections in curated-pages.mjs.
import {curatedSections,curatedListing,curatedArticle,programStatus} from './curated-pages.mjs';

export {programStatus};
export const programsPage=data=>curatedListing(curatedSections['open-source'],data);
export const programArticle=p=>curatedArticle(curatedSections['open-source'],p);
