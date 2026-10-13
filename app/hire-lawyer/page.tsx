import Intake from './Intake';
import type {Metadata} from 'next';
import {SITE_ORIGIN} from '../seo';
export const metadata:Metadata={title:'Request Help Finding a Georgia Attorney',description:'Tell LawVetter what kind of legal help you need so your request can be reviewed and matched with an appropriate Georgia attorney.',alternates:{canonical:SITE_ORIGIN+'/hire-lawyer'}};
export default function Page(){return <Intake/>;}
