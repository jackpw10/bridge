import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';

const tiles = [
  { to: '/admin/users', title: 'Users', desc: 'Manage user accounts and admin roles. New accounts sign up via /signup.' },
  { to: '/admin/workflow', title: 'Triage workflow', desc: 'Order and configure the questions users answer.' },
  { to: '/admin/health-authorities', title: 'Health Authorities', desc: 'The list of Health Authorities used by facilities and TA cards.' },
  { to: '/admin/facilities', title: 'Facilities', desc: 'Sites, on-site services, referral patterns, notifications.' },
  { to: '/admin/specialty', title: 'Specialty services', desc: 'LLTO / HLOC pre-questions, exception steps, Transport Advisor cards.' },
  { to: '/admin/diagnoses', title: 'Diagnoses', desc: 'Master list of diagnoses with optional notification triggers.' },
  { to: '/admin/process-steps', title: 'Generic process steps', desc: 'Universal steps for each of the four version buckets.' },
  { to: '/admin/reasons', title: 'Override reasons', desc: 'Reasons offered when a user overrides a referral pattern.' },
  { to: '/admin/reference-cards', title: 'Reference cards', desc: 'Quick-lookup cards available from the result screen.' },
];

export function AdminHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Admin</h1>
        <p className="text-sm text-slate-500">Configure how BRIDGE behaves for your team.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="block group">
            <Card title={t.title} description={t.desc} className="h-full group-hover:border-brand-400 group-hover:shadow-md transition-all">
              <span className="text-brand-600 text-sm font-medium">Open →</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
