import type {Metadata} from 'next';
import {siteOrigin} from '../../db/site-settings';
import SiteHeader from '../SiteHeader';
import ContactForm from './ContactForm';
import './contact.css';

export async function generateMetadata():Promise<Metadata>{return {title:'Contact LawVetter',description:'Contact the LawVetter team with questions, feedback, or requests.',alternates:{canonical:await siteOrigin()+'/contact'}};}

export default function ContactPage(){return <main><SiteHeader/><article className="contact-page-shell"><div className="contact-service-frame"><header className="contact-service-welcome"><div><p className="contact-eyebrow">CONTACT LAWVETTER</p><h1>You’re in the right place.</h1><p>Have a question, feedback, or a request? Send our team a message below.</p></div><svg className="contact-envelope" viewBox="0 0 96 80" fill="none" aria-hidden="true"><rect x="12" y="24" width="64" height="44" rx="7" stroke="currentColor" strokeWidth="4" transform="rotate(-10 44 46)"/><path d="m14 30 32 18 27-28M79 11l6-7M85 24l9-2M65 8V1" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg></header><ContactForm/></div></article></main>;}
