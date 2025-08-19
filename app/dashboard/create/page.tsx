'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { Camera, Upload, Video, ArrowLeft, ArrowRight, Plus, X, CheckCircle } from 'lucide-react'
import Header from '@/components/Header'
import toast from 'react-hot-toast'

interface ARExperience {
  id: string
  title: string
  mind_file_url: string
  video_file_url: string
  user_id: string
  created_at: string
  updated_at: string
}

export default function CreateExperience() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [mindFile, setMindFile] = useState<File | null>(null)

  const [submitting, setSubmitting] = useState(false)

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const result = reader.result as string
        // Remove the data:image/jpeg;base64, prefix
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = error => reject(error)
    })
  }

  const handleVideoUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Check file size (500MB limit to match server)
      const maxSizeInBytes = 500 * 1024 * 1024 // 500MB
      const fileSizeMB = file.size / 1024 / 1024
      
      console.log('📁 File validation:', {
        name: file.name,
        size: file.size,
        sizeMB: fileSizeMB.toFixed(2),
        maxSizeMB: 500,
        isUnderLimit: file.size <= maxSizeInBytes
      })
      
      if (file.size > maxSizeInBytes) {
        toast.error(`Video file too large. Maximum size is 500MB, your file is ${fileSizeMB.toFixed(1)}MB`)
        return
      }

      // Check file type
      const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/quicktime']
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Unsupported video format. Please use MP4, WebM, or MOV files. Current type: ${file.type}`)
        return
      }

      setVideoFile(file)
      toast.success('Video uploaded successfully!')
    }
  }, [])

  const handleMindUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.mind')) {
        toast.error('Please upload a .mind file')
        return
      }
      setMindFile(file)
      toast.success('Mind file uploaded successfully!')
    }
  }, [])

  const removeFile = useCallback((type: 'video' | 'mind') => {
    if (type === 'video') {
      setVideoFile(null)
    } else {
      setMindFile(null)
    }
    toast.success(`${type === 'video' ? 'Video' : 'Mind file'} removed`)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      toast.error('Please enter a title for your AR experience')
      return
    }
    
    if (!videoFile) {
      toast.error('Please upload a video file')
      return
    }

    if (!mindFile) {
      toast.error('Please upload a mind file')
      return
    }

    setSubmitting(true)

    try {
      // Upload video file using base64
      console.log('📤 Uploading video file:', {
        name: videoFile.name,
        size: videoFile.size,
        sizeMB: (videoFile.size / 1024 / 1024).toFixed(2),
        type: videoFile.type
      })
      
      // Upload video to Supabase storage (multipart/form-data)
      const maxVideoMB = 100
      if (videoFile.size > maxVideoMB * 1024 * 1024) {
        throw new Error(`Video file too large. Maximum size is ${maxVideoMB}MB.`)
      }
      const videoForm = new FormData()
      videoForm.append('file', videoFile)
      const videoResponse = await fetch('/api/upload/video', {
        method: 'POST',
        body: videoForm
      })

      if (!videoResponse.ok) {
        const err = await videoResponse.json().catch(() => null)
        throw new Error(err?.error || `Video upload failed (${videoResponse.status})`)
      }

      const videoData = await videoResponse.json()
      console.log('✅ Video uploaded successfully:', videoData.url)

      // Upload mind file to Supabase storage
      console.log('📤 Uploading mind file:', {
        name: mindFile.name,
        size: mindFile.size,
        type: mindFile.type
      })
      
      const mindForm = new FormData()
      mindForm.append('file', mindFile)
      const mindResponse = await fetch('/api/upload/mind', {
        method: 'POST',
        body: mindForm
      })

      if (!mindResponse.ok) {
        const err = await mindResponse.json().catch(() => null)
        throw new Error(err?.error || 'Mind file upload failed')
      }

      const mindData = await mindResponse.json()
      console.log('✅ Mind file uploaded successfully:', mindData.url)

      // Create AR experience in database
      console.log('💾 Creating AR experience in database...')
      
      const createResponse = await fetch('/api/ar-experiences/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          video_file_url: videoData.url,
          mind_file_url: mindData.url,
        }),
      })

      if (!createResponse.ok) {
        const err = await createResponse.json().catch(() => null)
        throw new Error(err?.error || 'Failed to create AR experience')
      }

      const newExperience = await createResponse.json()
      console.log('✅ AR experience created successfully:', newExperience)

      toast.success('AR experience created successfully!')
      
      // Redirect to the new experience
      router.push(`/experience/${newExperience.id}`)

    } catch (error) {
      console.error('❌ Error creating AR experience:', error)
      
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('An unexpected error occurred')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (!user) {
    router.push('/auth/signin')
    return null
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Navigation */}
      <Header
        showDashboard={false}
        showSignOut={true}
        userEmail={user?.email}
        onSignOut={() => router.push('/auth/signout')}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="text-center text-black mb-12">
          <div className="flex justify-center mb-6">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center text-red-600 hover:text-red-800 text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">
            Create AR Experience
          </h1>
          <p className="text-xl opacity-80 max-w-2xl mx-auto leading-relaxed">
            Build an augmented reality experience that plays videos when you point your camera at specific images
          </p>
        </div>

        {/* Step 1: Compile Image to AR Format */}
        <div className="bg-white border border-black rounded-2xl p-8 mb-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
          <div>
              <h3 className="text-2xl font-semibold mb-3 text-black flex items-center">
                <Camera className="h-6 w-6 mr-3 text-red-600" />
                Step 1: Compile Image to AR Format
            </h3>
              <p className="text-black opacity-80 text-lg">
                First, convert your image to AR-ready format using our compiler
            </p>
          </div>
          <Link
            href="/compiler"
              className="bg-red-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center shadow-lg"
          >
              Go to Compiler
              <ArrowLeft className="h-5 w-5 ml-2" />
          </Link>
        </div>
        
          <div className="bg-cream border border-black rounded-xl p-6">
            <h4 className="font-semibold text-black mb-4 text-lg">What happens in the compiler:</h4>
            <ul className="text-black space-y-2 text-base">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-red-600 rounded-full mr-3"></span>
                Upload your image (JPG, PNG, etc.)
              </li>
            <li className="flex items-center">
                <span className="w-2 h-2 bg-red-600 rounded-full mr-3"></span>
                Our AI processes it to create a .mind file
            </li>
            <li className="flex items-center">
                <span className="w-2 h-2 bg-red-600 rounded-full mr-3"></span>
                The .mind file contains the image recognition data
            </li>
            <li className="flex items-center">
                <span className="w-2 h-2 bg-red-600 rounded-full mr-3"></span>
                Download the .mind file to use in your AR experience
            </li>
          </ul>
        </div>
      </div>

        {/* Step 2: Create AR Experience Form */}
        <div className="bg-white border border-black rounded-2xl p-8 mb-8 shadow-lg">
          <h3 className="text-2xl font-semibold mb-6 text-black flex items-center">
            <Upload className="h-6 w-6 mr-3 text-red-600" />
            Step 2: Create New AR Experience
        </h3>
          
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Title Input */}
            <div>
              <label htmlFor="title" className="block text-lg font-medium text-black mb-3">
                Experience Title *
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-6 py-4 border-2 border-black rounded-xl focus:ring-2 focus:ring-red-600 focus:border-transparent text-lg"
                placeholder="Enter a descriptive title"
                required
              />
            </div>

            {/* File Uploads */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Video Upload */}
            <div>
              <label className="block text-lg font-medium text-black mb-3">
                Video File * <span className="text-sm font-normal text-black opacity-70">(Max 100MB)</span>
              </label>
              <div className="border-2 border-dashed border-black rounded-xl p-8 text-center hover:border-red-600 transition-colors">
                  {videoFile ? (
                    <div className="space-y-3">
                      <CheckCircle className="h-10 w-10 text-red-600 mx-auto" />
                      <p className="text-base text-black font-medium">{videoFile.name}</p>
                      <button
                        type="button"
                        onClick={() => removeFile('video')}
                        className="text-red-600 hover:text-red-800 text-sm flex items-center justify-center mx-auto font-medium"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </button>
            </div>
                  ) : (
            <div>
                      <Video className="h-10 w-10 text-black mx-auto mb-3" />
                      <p className="text-base text-black">
                        <label htmlFor="video-upload" className="cursor-pointer text-red-600 hover:text-red-800 font-semibold">
                          Click to upload video
              </label>
              </p>
                      <p className="text-sm text-black opacity-70 mt-2">MP4, WebM, or other common formats</p>
                <input
                          id="video-upload"
                  type="file"
                          accept="video/mp4,video/webm,video/ogg,video/avi,video/mov,video/quicktime"
                          onChange={handleVideoUpload}
                  className="hidden"
                />
              </div>
                  )}
                </div>
            </div>

              {/* Mind File Upload */}
              <div>
                <label className="block text-lg font-medium text-black mb-3">
                  Mind File (.mind) *
                </label>
                <div className="border-2 border-dashed border-black rounded-xl p-8 text-center hover:border-red-600 transition-colors">
                  {mindFile ? (
                    <div className="space-y-3">
                      <CheckCircle className="h-10 w-10 text-red-600 mx-auto" />
                      <p className="text-base text-black font-medium">{mindFile.name}</p>
                      <button
                        type="button"
                        onClick={() => removeFile('mind')}
                        className="text-red-600 hover:text-red-800 text-sm flex items-center justify-center mx-auto font-medium"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </button>
                    </div>
                  ) : (
            <div>
                      <Upload className="h-10 w-10 text-black mx-auto mb-3" />
                      <p className="text-base text-black">
                        <label htmlFor="mind-upload" className="cursor-pointer text-red-600 hover:text-red-800 font-semibold">
                          Upload .mind file
              </label>
              </p>
                      <p className="text-sm text-black opacity-70 mt-2">From Step 1 compiler</p>
                <input
                        id="mind-upload"
                  type="file"
                        accept=".mind"
                        onChange={handleMindUpload}
                  className="hidden"
                />
              </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-center pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="bg-red-600 text-white px-12 py-4 rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-lg shadow-lg"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    Uploading Files...
                  </>
                ) : (
                  <>
                    <Plus className="h-6 w-6 mr-2" />
                    Create AR Experience
                  </>
                )}
              </button>
            </div>


          </form>
        </div>
        
        {/* How to Use Your AR Experience */}
        <div className="bg-white border border-black rounded-2xl p-8 shadow-lg">
          <h3 className="text-2xl font-semibold mb-6 text-black flex items-center">
            <Camera className="h-6 w-6 mr-3 text-red-600" />
            How to Use Your AR Experience
          </h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold text-black mb-4 text-lg">For You (Creator):</h4>
              <ol className="text-black space-y-3 list-decimal list-inside text-base">
                <li>After creating, you'll get a unique link to your experience</li>
                <li>Share this link with others or embed it on your website</li>
                <li>You can edit or delete your experience anytime from your dashboard</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold text-black mb-4 text-lg">For Users:</h4>
              <ol className="text-black space-y-3 list-decimal list-inside text-base">
                <li>Open the link on their phone (works best on mobile)</li>
                <li>Allow camera access when prompted</li>
                <li>Point their camera at the image you used to create the .mind file</li>
                <li>Your video will automatically play overlaid on the image!</li>
              </ol>
            </div>
          </div>
          
          <div className="mt-8 p-6 bg-cream border-2 border-black rounded-xl">
            <h4 className="font-semibold text-black mb-3 text-lg">💡 Pro Tips:</h4>
            <ul className="text-black space-y-2 text-base">
              <li>• Use high-quality, clear images for better recognition</li>
              <li>• Keep videos under 2 minutes for best performance</li>
              <li>• Test your experience on different devices</li>
              <li>• Good lighting helps the camera recognize your image</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
} 
