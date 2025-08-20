import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Enable mock mode to bypass Supabase storage for quick local testing
// Set MOCK_UPLOADS=1 (or true) in .env.local to activate
const isMock = (process.env.MOCK_UPLOADS || '').toLowerCase() === '1' || (process.env.MOCK_UPLOADS || '').toLowerCase() === 'true'

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 Video upload request received')
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    console.log('📁 File details:', {
      name: file.name,
      size: file.size,
      sizeMB: (file.size / 1024 / 1024).toFixed(2),
      type: file.type
    })

    // Check file size (limit from environment or default to 100MB)
    const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '100')
    const maxSizeInBytes = maxSizeMB * 1024 * 1024
    console.log('📏 Size check:', {
      fileSize: file.size,
      maxSize: maxSizeInBytes,
      isOverLimit: file.size > maxSizeInBytes
    })
    
    if (file.size > maxSizeInBytes) {
      return NextResponse.json({ 
        error: `Video file too large. Maximum size is ${maxSizeMB}MB, your file is ${(file.size / 1024 / 1024).toFixed(1)}MB` 
      }, { status: 413 })
    }

    // Check file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/quicktime']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: `Unsupported video format. Please use MP4, WebM, or MOV files. Current type: ${file.type}` 
      }, { status: 400 })
    }

    // In mock mode, skip storage and return a fake URL
    if (isMock) {
      const safeName = file.name?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'video.mp4'
      const fileName = `video-${Date.now()}-${safeName}`
      return NextResponse.json({
        success: true,
        url: `https://mock.local/uploads/videos/${fileName}`
      })
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase
    const fileName = `video-${Date.now()}-${file.name}`

    // Create Supabase client lazily to avoid requiring envs in mock mode
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Supabase configuration missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY).' }, { status: 500 })
    }
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    })

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw new Error(`Failed to upload video: ${uploadError.message}`)
    }

    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(fileName)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl
    })

  } catch (error) {
    console.error('Video upload error:', error)
    return NextResponse.json(
      { error: `Video upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}