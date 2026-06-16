import { useState } from 'react'
import type { Release } from '../types'
import { CollectionGrid } from '../components/CollectionGrid'
import { AddReleaseModal } from '../components/AddReleaseModal'

interface HomePageProps {
  releases: Release[]
  onAddRelease: (release: Release) => void
}

export function HomePage({ releases, onAddRelease }: HomePageProps) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-white">My Collection</h2>
          <p className="mt-0.5 text-sm text-muted">
            {releases.length === 0
              ? 'No releases yet'
              : `${releases.length} ${releases.length === 1 ? 'release' : 'releases'}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
        >
          + Add Release
        </button>
      </div>

      <CollectionGrid releases={releases} />

      {showModal && (
        <AddReleaseModal
          onSave={(release) => {
            onAddRelease(release)
            setShowModal(false)
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
