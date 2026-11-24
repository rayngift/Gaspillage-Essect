import { ArrowRight, GraduationCap, Lock, ShieldCheck, Store } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { ActiveView } from '../types/campussave';

interface RoleSelectorViewProps {
  user: User;
  isAdmin: boolean;
  isMerchant: boolean;
  activeOrderCount: number;
  approvedShopsCount: number;
  offersCount: number;
  onSelectPortal: (view: ActiveView) => void;
}

export function RoleSelectorView({
  user,
  isAdmin,
  isMerchant,
  activeOrderCount,
  approvedShopsCount,
  offersCount,
  onSelectPortal,
}: RoleSelectorViewProps) {
  const displayName = user.displayName || user.email?.split('@')[0] || 'Membre ESSECT';

  return (
    <section className="space-y-8 py-4">
      <div className="max-w-2xl space-y-2">
        <p className="text-xs font-medium text-[#166534]">
          Session connectée · {user.email}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 text-balance">
          Bienvenue, {displayName}. Choisissez votre espace CampusSave.
        </h1>
        <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
          {isAdmin
            ? 'Chaque espace est sécurisé selon votre rôle : Étudiant, Commerçant partenaire ou Administrateur.'
            : 'Chaque espace est sécurisé selon votre rôle : Étudiant ou Commerçant partenaire.'}
        </p>
      </div>

      <div
        className={`grid grid-cols-1 ${
          isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'
        } gap-6 items-stretch`}
      >
        {/* Panel 1: Étudiant */}
        <article className="bg-white border border-neutral-200 rounded-2xl p-7 flex flex-col justify-between gap-6 transition-colors hover:border-[#166534]">
          <div className="space-y-4">
            <div className="w-11 h-11 rounded-xl bg-[#166534]/10 text-[#166534] flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[#166534]">
                01 · Espace Étudiant
              </p>
              <h2 className="text-xl font-bold text-neutral-900">
                Étudiant ESSECT
              </h2>
            </div>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Consultez les paniers disponibles autour du campus, explorez le Campus Radar, payez via Konnect et récupérez votre commande par QR Code.
            </p>
            <p className="text-xs font-mono tabular-nums text-neutral-500 pt-1">
              {offersCount} offre(s) en ligne · {activeOrderCount} QR actif(s)
            </p>
          </div>

          <button
            type="button"
            onClick={() => onSelectPortal('offers')}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#166534] text-white text-sm font-medium rounded-lg hover:bg-[#14532d] transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#166534]"
          >
            <span>Entrer comme Étudiant</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </article>

        {/* Panel 2: Commerçant (accessible to merchant and admin) */}
        {(() => {
          const canEnterMerchant = isMerchant || isAdmin;
          return (
            <article
              className={`bg-white border rounded-2xl p-7 flex flex-col justify-between gap-6 transition-colors ${
                canEnterMerchant
                  ? 'border-neutral-200 hover:border-[#166534]'
                  : 'border-neutral-200 bg-neutral-50/60'
              }`}
            >
              <div className="space-y-4">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    canEnterMerchant
                      ? 'bg-[#166534]/10 text-[#166534]'
                      : 'bg-neutral-200/70 text-neutral-500'
                  }`}
                >
                  {canEnterMerchant ? (
                    <Store className="w-5 h-5" />
                  ) : (
                    <Lock className="w-5 h-5" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <p
                    className={`text-xs font-medium ${
                      canEnterMerchant ? 'text-[#166534]' : 'text-neutral-500'
                    }`}
                  >
                    02 · Espace Commerçant
                  </p>
                  <h2 className="text-xl font-bold text-neutral-900">
                    Commerçant partenaire
                  </h2>
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Inscrivez votre restaurant, cafétéria ou boulangerie, publiez vos invendus à prix réduit et validez les retraits QR Code des étudiants.
                </p>
                <p
                  className={`text-xs font-medium pt-1 ${
                    canEnterMerchant ? 'text-[#166534]' : 'text-neutral-500'
                  }`}
                >
                  {canEnterMerchant
                    ? `Accès vérifié · ${approvedShopsCount} commerce(s) actif(s)`
                    : 'Accès restreint aux comptes commerçants'}
                </p>
              </div>

              <button
                type="button"
                disabled={!canEnterMerchant}
                onClick={() => onSelectPortal('merchant')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900"
              >
                <span>
                  {canEnterMerchant ? 'Entrer comme Commerçant' : 'Compte non commerçant'}
                </span>
                {canEnterMerchant && <ArrowRight className="w-4 h-4" />}
              </button>
            </article>
          );
        })()}

        {/* Panel 3: Administrateur (only visible to admins) */}
        {isAdmin && (
          <article className="bg-white border border-neutral-200 hover:border-[#166534] rounded-2xl p-7 flex flex-col justify-between gap-6 transition-colors">
            <div className="space-y-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#166534]/10 text-[#166534]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[#166534]">
                  03 · Espace Administrateur
                </p>
                <h2 className="text-xl font-bold text-neutral-900">
                  Administrateur
                </h2>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Validez les inscriptions des commerces partenaires, attribuez les rôles utilisateurs et supervisez l’impact global de la plateforme.
              </p>
              <p className="text-xs font-medium pt-1 text-[#166534]">
                Accès administrateur vérifié
              </p>
            </div>

            <button
              type="button"
              onClick={() => onSelectPortal('admin')}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#166534] text-white text-sm font-medium rounded-lg hover:bg-[#14532d] transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#166534]"
            >
              <span>Entrer comme Administrateur</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </article>
        )}
      </div>
    </section>
  );
}
