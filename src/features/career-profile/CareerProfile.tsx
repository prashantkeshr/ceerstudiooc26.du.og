import type { CareerProfile, ResumeContent } from '../../core/models/types';
import { useStore } from '../../state/store';
import { ResumeEditor } from '../resume-studio/ResumeEditor';

export function CareerProfilePage() {
  const { profile, updateProfile, profileSave } = useStore();

  // The profile is structurally a superset of ResumeContent, so the same
  // structured editor drives it. Spreads inside the editor preserve the extra
  // profile fields (id, objective, updatedAt).
  const patch = (fn: (c: ResumeContent) => ResumeContent) =>
    updateProfile((p) => fn(p) as CareerProfile);

  const saveText = profileSave === 'saving' ? 'Saving…' : profileSave === 'saved' ? 'Saved locally' : profileSave === 'error' ? 'Save failed' : '';

  return (
    <div className="content">
      <div className="page-head">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1>Career Profile</h1>
            <p>Your master information. Resumes and other documents reuse it — edit once, use everywhere.</p>
          </div>
          <span className="save-pill" role="status" aria-live="polite"><span className={`save-dot ${profileSave}`} />{saveText}</span>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
        <ResumeEditor content={profile} patch={patch} />
      </div>
    </div>
  );
}
