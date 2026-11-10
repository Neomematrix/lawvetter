import {projectId} from '../../../db/site-settings';
export function GET(){return Response.json({site:'LawVetter',projectId},{headers:{'Cache-Control':'no-store'}});}
