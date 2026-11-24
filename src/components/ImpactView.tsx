import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { Order, UserProfile } from '../types/campussave';

interface ImpactViewProps {
  user: User;
  userProfile: UserProfile | null;
  orders: Order[];
  mealsSaved: number;
  co2SavedKg: number;
  studentSavingsTnd: number;
  ecoPoints: number;
  onSignOut: () => void;
}

export function ImpactView({
  user,
  userProfile,
  orders,
  mealsSaved,
  co2SavedKg,
  studentSavingsTnd,
  ecoPoints,
  onSignOut,
}: ImpactViewProps) {
  const currentName =
    userProfile?.displayName ||
    user.displayName ||
    user.email?.split('@')[0] ||
    'Étudiant ESSECT';

  const [displayNameInput, setDisplayNameInput] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayNameInput(currentName);
  }, [currentName]);

  const paidOrdersCount = orders.filter((o) => o.status !== 'cancelled').length;
  const pickedUpCount = orders.filter((o) => o.status === 'picked_up').length;
  const roleLabel = userProfile?.role || 'student';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);
    setSaveError(null);

    const trimmed = displayNameInput.trim().slice(0, 80);
    if (trimmed.length < 1) {
      setSaveError('Veuillez saisir un nom affiché valide.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile(user, { displayName: trimmed });

      const userRef = doc(db, 'users', user.uid);
      if (userProfile) {
        await updateDoc(userRef, {
          displayName: trimmed,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, {
          uid: user.uid,
          displayName: trimmed,
          email: (user.email || '').slice(0, 120),
          photoUrl: (user.photoURL || '').slice(0, 500),
          role: 'student',
          campus: 'ESSECT Montfleury',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setSaveMessage('Profil mis à jour avec succès.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      {/* Identity Card */}
      <div className="bg-white border border-neutral-200 rounded-2xl px-6 py-5 space-y-1">
        <h1 className="text-xl font-bold text-neutral-900">{currentName}</h1>
        <p className="text-sm text-neutral-500">
          {user.email} · Rôle: {roleLabel}
        </p>
      </div>

      {/* Mon bilan CampusSave */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-neutral-900">
            Mon bilan CampusSave
          </h2>
          <p className="text-xs font-mono tabular-nums text-neutral-500">
            {mealsSaved} repas sauvé(s) · {co2SavedKg.toFixed(1).replace(/\.0$/, '')} kg CO₂ évité · {ecoPoints} EcoPoints
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-neutral-200 rounded-xl px-4 py-3.5 bg-white">
            <p className="text-xs text-neutral-500 mb-1">Commandes payées</p>
            <p className="text-lg font-bold font-mono tabular-nums text-[#166534]">
              {paidOrdersCount}
            </p>
          </div>

          <div className="border border-neutral-200 rounded-xl px-4 py-3.5 bg-white">
            <p className="text-xs text-neutral-500 mb-1">Récupérées</p>
            <p className="text-lg font-bold font-mono tabular-nums text-[#166534]">
              {pickedUpCount}
            </p>
          </div>

          <div className="border border-neutral-200 rounded-xl px-4 py-3.5 bg-white">
            <p className="text-xs text-neutral-500 mb-1">Économisé</p>
            <p className="text-lg font-bold font-mono tabular-nums text-[#166534]">
              {studentSavingsTnd.toFixed(2)} TND
            </p>
          </div>
        </div>
      </div>

      {/* Modifier mon profil */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4"
      >
        <h2 className="text-base font-bold text-neutral-900">
          Modifier mon profil
        </h2>

        {saveError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {saveError}
          </div>
        )}
        {saveMessage && (
          <div className="p-3 rounded-lg bg-[#166534]/10 border border-[#166534]/20 text-xs text-[#166534]">
            {saveMessage}
          </div>
        )}

        <div className="relative pt-1">
          <label
            htmlFor="impact-display-name"
            className="absolute left-3 -top-1 px-1 bg-white text-xs text-neutral-500"
          >
            Nom affiché
          </label>
          <input
            id="impact-display-name"
            type="text"
            required
            maxLength={80}
            value={displayNameInput}
            onChange={(e) => setDisplayNameInput(e.target.value)}
            className="w-full h-12 px-3.5 rounded-lg border border-neutral-300 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-[#166534]"
          />
        </div>

        <div className="space-y-2.5 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="w-full h-11 rounded-full bg-[#166534] text-white text-sm font-medium hover:bg-[#14532d] disabled:opacity-60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#166534]"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full h-11 rounded-full border border-neutral-300 bg-white text-neutral-700 text-sm font-medium hover:bg-neutral-50 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </form>
    </section>
  );
}
