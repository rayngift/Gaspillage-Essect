import { GraduationCap, Lock, ShieldCheck, Store } from 'lucide-react';

interface AuthGateCardProps {
  title: string;
  description: string;
  loading: boolean;
  onSignIn: () => void;
}

export function AuthGateCard({
  title,
  description,
  loading,
  onSignIn,
}: AuthGateCardProps) {
  return (
    <section className="bg-white border border-neutral-200 rounded-2xl p-7 sm:p-9 space-y-7">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-7 border-b border-neutral-100">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[#166534]">
            <Lock className="w-3.5 h-3.5" />
            <span>Accès réservé aux membres connectés</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 text-balance">
            {title}
          </h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            {description}
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={onSignIn}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#166534] text-white text-sm font-medium rounded-lg hover:bg-[#14532d] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#166534]"
        >
          {loading ? 'Connexion en cours...' : 'Connexion avec Google'}
        </button>
      </div>

      {/* 3 actor panels preview before sign-in */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-[#FAFAFA] border border-neutral-200 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
            <GraduationCap className="w-4 h-4 text-[#166534]" />
            <span>Étudiant</span>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Consulte les offres ESSECT, réserve les paniers via Konnect et récupère avec son QR Code.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#FAFAFA] border border-neutral-200 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
            <Store className="w-4 h-4 text-[#166534]" />
            <span>Commerçant</span>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Gère son établissement autour du campus, publie ses invendus et valide les retraits QR Code.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#FAFAFA] border border-neutral-200 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
            <ShieldCheck className="w-4 h-4 text-[#166534]" />
            <span>Administrateur</span>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Valide les commerces partenaires, gère les utilisateurs et supervise l’impact anti-gaspillage.
          </p>
        </div>
      </div>
    </section>
  );
}
