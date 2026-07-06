import { Link } from 'react-router-dom';
import { formatCurrency } from '../api/client';
import { getRelevantImageUrl } from '../utils/imageHelper';
import './ProgrammeCard.css';

export default function ProgrammeCard({ programme, index = 0 }) {
  return (
    <div className="programme-card card">
      <div className="programme-card-image">
        <img
          src={getRelevantImageUrl(programme)}
          alt={programme.name}
          loading="lazy"
        />
      </div>
      <div className="programme-card-body">
        <span className="programme-badge">{programme.degree}</span>
        <h3>{programme.name}</h3>
        <p className="programme-meta">{programme.duration} &bull; {programme.type}</p>
        <p className="programme-faculty">{programme.faculty_name}</p>
        {programme.min_qualification && (
          <p className="programme-min-grade">Min. KCSE: {programme.min_qualification}</p>
        )}
        <div className="programme-card-footer">
          <span className="programme-fees">{formatCurrency(programme.fees)}/yr</span>
          <Link to={`/programmes/${programme.id}`} className="btn btn-sm btn-primary">View Details</Link>
        </div>
      </div>
    </div>
  );
}
