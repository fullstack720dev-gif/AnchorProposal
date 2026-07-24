'use client';

import { Briefcase, Search, Filter } from 'lucide-react';

export default function JobPoolPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">Job Pool</h1>
        <p className="text-slate-500">Browse and import job postings</p>
      </div>

      <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-center gap-3">
        <Briefcase className="w-5 h-5 text-primary" strokeWidth={1.5} />
        <div>
          <p className="font-medium text-primary-deep">Coming Soon</p>
          <p className="text-sm text-primary/80">Job Pool integration is planned for a future release. Use manual application entry for now.</p>
        </div>
      </div>

      <div className="bg-white border border-[var(--border)] rounded-xl">
        <div className="p-4 border-b border-[var(--border)] flex gap-3 opacity-50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input disabled placeholder="Search jobs..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <button disabled className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-400">
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>

        <div className="p-12 text-center">
          <Briefcase className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-600 mb-2">No jobs available</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Job Pool will aggregate postings from approved sources. For now, create applications manually from the Applications page.
          </p>
        </div>
      </div>
    </div>
  );
}
