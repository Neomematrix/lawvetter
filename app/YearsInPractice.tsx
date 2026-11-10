import {yearsInPracticeLabel} from './years-in-practice';
export default function YearsInPractice({admitted}:{admitted?:string|null}) {
 const label = yearsInPracticeLabel(admitted);
 return label ? <p className="years-in-practice">{label}</p> : null;
}
