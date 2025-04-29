'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Play, Pause, Volume2 } from 'lucide-react'
import { Slider } from '@/components/ui/slider'

interface AudioMessageProps {
  message: string
}

export default function AudioMessage({ message }: AudioMessageProps) {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const generateAudio = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: message }),
        })

        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audioElement = new Audio(audioUrl)
        
        audioElement.addEventListener('timeupdate', () => {
          setProgress((audioElement.currentTime / audioElement.duration) * 100)
        })

        setAudio(audioElement)
      } catch (error) {
        console.error('Error generating audio:', error)
      } finally {
        setIsLoading(false)
      }
    }

    generateAudio()

    return () => {
      if (audio) {
        audio.pause()
        URL.revokeObjectURL(audio.src)
      }
    }
  }, [message])

  const togglePlayPause = () => {
    if (audio) {
      if (isPlaying) {
        audio.pause()
      } else {
        audio.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)
    if (audio) {
      audio.volume = newVolume
    }
  }

  return (
    <Card className="p-4 w-full max-w-md">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          disabled={isLoading || !audio}
          onClick={togglePlayPause}
        >
          {isLoading ? (
            <div className="animate-spin h-4 w-4 border-2 border-primary rounded-full" />
          ) : isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <div className="flex-1">
          <div className="bg-secondary h-2 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          <Slider
            defaultValue={[1]}
            max={1}
            step={0.1}
            value={[volume]}
            onValueChange={handleVolumeChange}
            className="w-24"
          />
        </div>
      </div>
    </Card>
  )
}
