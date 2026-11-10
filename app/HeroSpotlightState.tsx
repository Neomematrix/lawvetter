export default function HeroSpotlightState({loading=false}:{loading?:boolean}){
 return <div className="hero-spotlight-state" role={loading?'status':undefined}><p className="section-kicker">LAWVETTER SPOTLIGHT</p><h2>Most searched this month</h2><p>{loading?'Loading the latest leading attorney…':'Monthly rankings are taking shape. Explore the attorneys visitors are searching for.'}</p>{!loading&&<a className="gold-button" href="/?view=charts&period=monthly">Explore the charts</a>}</div>;
}
