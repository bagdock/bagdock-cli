import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setOutputMode, isJsonMode, isQuiet, outputSuccess, outputError, outputList, status } from '../src/output'

describe('output module', () => {
  beforeEach(() => {
    setOutputMode({ json: false, quiet: false })
  })

  describe('setOutputMode', () => {
    it('sets json mode when --json is passed', () => {
      setOutputMode({ json: true })
      expect(isJsonMode()).toBe(true)
      expect(isQuiet()).toBe(false)
    })

    it('sets quiet mode which implies json', () => {
      setOutputMode({ quiet: true })
      expect(isJsonMode()).toBe(true)
      expect(isQuiet()).toBe(true)
    })
  })

  describe('outputSuccess', () => {
    it('writes JSON to stdout in json mode', () => {
      setOutputMode({ json: true })
      const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
      outputSuccess({ hello: 'world' })
      expect(spy).toHaveBeenCalledOnce()
      const output = spy.mock.calls[0][0] as string
      expect(JSON.parse(output)).toEqual({ hello: 'world' })
    })
  })

  describe('outputList', () => {
    it('writes list envelope in json mode', () => {
      setOutputMode({ json: true })
      const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
      outputList('item', [{ id: '1' }], false)
      const output = JSON.parse(spy.mock.calls[0][0] as string)
      expect(output.object).toBe('list')
      expect(output.data).toHaveLength(1)
      expect(output.has_more).toBe(false)
    })
  })

  describe('status', () => {
    it('prints to console in interactive mode', () => {
      setOutputMode({ json: false, quiet: false })
      const origTTY = process.stdout.isTTY
      Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      status('loading...')
      expect(spy).toHaveBeenCalledOnce()
      Object.defineProperty(process.stdout, 'isTTY', { value: origTTY, configurable: true })
    })

    it('suppresses output in quiet mode', () => {
      setOutputMode({ quiet: true })
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      status('loading...')
      expect(spy).not.toHaveBeenCalled()
    })
  })
})
