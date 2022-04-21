/* eslint-env jest */
import chalk from 'chalk'

import { wrapPlugin } from '../utils/test-helpers'
import plugin from './sinon'

chalk.level = 0

const wrappedPlugin = wrapPlugin(plugin)
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation().mockClear()
})

function expectTransformation(source, expectedOutput, options = {}) {
  const result = wrappedPlugin(source, options)
  expect(result).toBe(expectedOutput)
  expect(console.warn).toBeCalledTimes(0)
}

it('removes imports', () => {
  expectTransformation(
    `
      import foo from 'foo'
      import sinon from 'sinon-sandbox';
`,
    `
      import foo from 'foo'
`
  )
})

describe('spies and stubs', () => {
  it('handles spies', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'
        const stub = sinon.stub(Api, 'get')
        sinon.stub(I18n, 'extend');
        sinon.stub(AirbnbUser, 'current').returns(currentUser);
        sinon.spy(I18n, 'extend');
        sinon.spy();
        sinon.spy(() => 'foo');
`,
      `
        const stub = jest.spyOn(Api, 'get').mockClear()
        jest.spyOn(I18n, 'extend').mockClear();
        jest.spyOn(AirbnbUser, 'current').mockClear().mockReturnValue(currentUser);
        jest.spyOn(I18n, 'extend').mockClear();
        jest.fn();
        jest.fn().mockImplementation(() => 'foo');
`
    )
  })

  it('handles 3rd argument implementation fn', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'
        sinon.stub(I18n, 'extend', () => 'foo');
`,
      `
        jest.spyOn(I18n, 'extend').mockClear().mockImplementation(() => 'foo');
`
    )
  })

  it('mock clear if spy added in beforeEach', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'

        beforeEach(() => {
          sinon.stub(Api, 'get')
          const s1 = sinon.stub(I18n, 'extend')
          const s2 = sinon.stub(I18n, 'extend').returns('en')
          sinon.stub(L10n, 'language').returns('en')
          sinon.stub(I18n, 'extend', () => 'foo');
        })
`,
      `
        beforeEach(() => {
          jest.spyOn(Api, 'get').mockClear()
          const s1 = jest.spyOn(I18n, 'extend').mockClear()
          const s2 = jest.spyOn(I18n, 'extend').mockClear().mockReturnValue('en')
          jest.spyOn(L10n, 'language').mockClear().mockReturnValue('en')
          jest.spyOn(I18n, 'extend').mockClear().mockImplementation(() => 'foo');
        })
`
    )
  })

  it('handles returns', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'
        const stub1 = sinon.stub(Api, 'get').returns('foo')
        const stub2 = sinon.stub(Api, 'get').returns(Promise.resolve({ foo: '1' }))
`,
      `
        const stub1 = jest.spyOn(Api, 'get').mockClear().mockReturnValue('foo')
        const stub2 = jest.spyOn(Api, 'get').mockClear().mockReturnValue(Promise.resolve({ foo: '1' }))
`
    )
  })

  it('handles .returnsArg', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'
        sinon.stub(foo, 'getParam').returnsArg(3);
  `,
      `
        jest.spyOn(foo, 'getParam').mockClear().mockImplementation((...args) => args[3]);
  `
    )
  })

  it('handles .withArgs returns', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'

        sinon.stub().withArgs('foo').returns('something')
        sinon.stub().withArgs('foo', 'bar').returns('something')
        sinon.stub().withArgs('foo', 'bar', 1).returns('something')
        sinon.stub(Api, 'get').withArgs('foo', 'bar', 1).returns('something')
        const stub = sinon.stub(foo, 'bar').withArgs('foo', 1).returns('something')
        sinon.stub(foo, 'bar').withArgs('foo', sinon.match.object).returns('something')
        sinon.stub().withArgs('foo', sinon.match.any).returns('something')
`,
      `
        jest.fn().mockImplementation((...args) => {
                if (args[0] === 'foo')
                        return 'something';
        })
        jest.fn().mockImplementation((...args) => {
                if (args[0] === 'foo' && args[1] === 'bar')
                        return 'something';
        })
        jest.fn().mockImplementation((...args) => {
                if (args[0] === 'foo' && args[1] === 'bar' && args[2] === 1)
                        return 'something';
        })
        jest.spyOn(Api, 'get').mockClear().mockImplementation((...args) => {
                if (args[0] === 'foo' && args[1] === 'bar' && args[2] === 1)
                        return 'something';
        })
        const stub = jest.spyOn(foo, 'bar').mockClear().mockImplementation((...args) => {
                if (args[0] === 'foo' && args[1] === 1)
                        return 'something';
        })
        jest.spyOn(foo, 'bar').mockClear().mockImplementation((...args) => {
                if (args[0] === 'foo' && typeof args[1] === 'object')
                        return 'something';
        })
        jest.fn().mockImplementation((...args) => {
                if (args[0] === 'foo' && args.length >= 2)
                        return 'something';
        })
`
    )
  })

  /* 
    apiStub.getCall(0).args[1].data
    apistub.args[1][1]
  */
  it('handles .getCall, .getCalls and spy arguments', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'

        apiStub.getCall(0)
        apiStub.getCall(0).args[1].data
        dispatch.getCall(0).args[0]
        onPaginate.getCall(0).args
        api.get.getCall(0).args[0][1]

        api.getCalls()[2]
        api.getCalls()[2].args
`,
      `
        apiStub.mock.calls[0]
        apiStub.mock.calls[0][1].data
        dispatch.mock.calls[0][0]
        onPaginate.mock.calls[0]
        api.get.mock.calls[0][0][1]

        api.mock.calls[2]
        api.mock.calls[2]
`
    )
  })

  it('handles .args[n]', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'

        apiStub.args[2][3]
        apiStub.foo.bar.args[2][3]

        // just remove .args
        apiStub.mock.calls[0].args[3]
`,
      `
        apiStub.mock.calls[2][3]
        apiStub.foo.bar.mock.calls[2][3]

        // just remove .args
        apiStub.mock.calls[0][3]
`
    )
  })

  it('handles .nthCall', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'

        apiStub.firstCall
        apiStub.firstCall.args[1].data
        apiStub.secondCall
        apiStub.secondCall.args[1].data
        apiStub.thirdCall
        apiStub.thirdCall.args[1].data
        apiStub.lastCall
        apiStub.lastCall.args[1].data
`,
      `
        apiStub.mock.calls[0]
        apiStub.mock.calls[0][1].data
        apiStub.mock.calls[1]
        apiStub.mock.calls[1][1].data
        apiStub.mock.calls[2]
        apiStub.mock.calls[2][1].data
        apiStub.mock.lastCall
        apiStub.mock.lastCall[1].data
`
    )
  })
})

describe('mocks', () => {
  it('handles creating mocks', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'
        const stub = sinon.stub()
`,
      `
        const stub = jest.fn()
`
    )
  })

  it('handles resets/clears', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'
        stub.restore()
        Api.get.restore()
        Api.get.reset()
        sinon.restore()
`,
      `
        stub.mockRestore()
        Api.get.mockRestore()
        Api.get.mockReset()
        jest.restoreAllMocks()
`
    )
  })
})

describe('sinon.match', () => {
  it('handles creating mocks', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'

        sinon.match({
          foo: 'foo'
        })
        sinon.match({
          foo: sinon.match({
            bar: 'bar'
          })
        })
        expect(foo).toEqual(sinon.match.number)
        foo(sinon.match.number)
        foo(sinon.match.string)
        foo(sinon.match.object)
        foo(sinon.match.func)
        foo(sinon.match.array)
        foo(sinon.match.any)
`,
      `
        expect.objectContaining({
          foo: 'foo'
        })
        expect.objectContaining({
          foo: expect.objectContaining({
            bar: 'bar'
          })
        })
        expect(foo).toEqual(expect.any(Number))
        foo(expect.any(Number))
        foo(expect.any(String))
        foo(expect.any(Object))
        foo(expect.any(Function))
        foo(expect.any(Array))
        foo(expect.anything())
`
    )
  })
})

describe('spy count and call assertions', () => {
  it('handles call count assertions', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'

        // basic cases
        expect(Api.get.callCount).to.equal(1)
        expect(spy.callCount).to.equal(1)

        expect(Api.get.called).to.equal(true)
        expect(spy.called).to.equal(true)
        expect(Api.get.called).toEqual(true)
        expect(spy.called).toEqual(true)

        expect(spy.calledOnce).to.equal(true)
        expect(spy.calledTwice).to.equal(true)
        expect(spy.calledThrice).to.equal(true)
        expect(spy.called).to.equal(true)

        // .to.be
        expect(Api.get.callCount).to.be(1)
        expect(Api.get.called).to.be(true)
        expect(Api.get.called).to.be(false)
        expect(Api.get.callCount).toBe(1)
        expect(Api.get.called).toBe(true)

        // .not + neg cases
        expect(Api.get.callCount).not.to.equal(1)
        expect(spy.called).not.to.be(true)
        expect(spy.callCount).not.to.be(1)
        expect(spy.called).to.be(false)

        // .notCalled cases
        expect(spy.notCalled).to.equal(true)
        expect(spy.notCalled).to.equal(false)
`,
      `
        expect(Api.get).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledTimes(1)

        expect(Api.get).toHaveBeenCalled()
        expect(spy).toHaveBeenCalled()
        expect(Api.get).toHaveBeenCalled()
        expect(spy).toHaveBeenCalled()

        expect(spy).toHaveBeenCalledTimes(1)
        expect(spy).toHaveBeenCalledTimes(2)
        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenCalled()

        // .to.be
        expect(Api.get).toHaveBeenCalledTimes(1)
        expect(Api.get).toHaveBeenCalled()
        expect(Api.get).not.toHaveBeenCalled()
        expect(Api.get).toHaveBeenCalledTimes(1)
        expect(Api.get).toHaveBeenCalled()

        // .not + neg cases
        expect(Api.get).not.toHaveBeenCalledTimes(1)
        expect(spy).not.toHaveBeenCalled()
        expect(spy).not.toHaveBeenCalledTimes(1)
        expect(spy).not.toHaveBeenCalled()

        // .notCalled cases
        expect(spy).not.toHaveBeenCalled()
        expect(spy).toHaveBeenCalled()
`
    )
  })

  it('handles call counts with args', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'
        expect(spy.withArgs('foo', bar).called).to.be(true)
        expect(spy.withArgs('foo', bar).called).to.be(false)
`,
      `
        expect(spy).toHaveBeenCalledWith('foo', bar)
        expect(spy).not.toHaveBeenCalledWith('foo', bar)
`
    )
  })

  it('handles calledWith', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'
        expect(spy.calledWith(1, 2, 3)).to.be(true)
        expect(spy.notCalledWith(1, 2, 3)).to.be(true)
        expect(spy.calledWith(foo, 'bar')).to.be(false)
        expect(spy.notCalledWith(foo, 'bar')).to.be(false)
`,
      `
        expect(spy).toHaveBeenCalledWith(1, 2, 3)
        expect(spy).not.toHaveBeenCalledWith(1, 2, 3)
        expect(spy).not.toHaveBeenCalledWith(foo, 'bar')
        expect(spy).toHaveBeenCalledWith(foo, 'bar')
`
    )
  })
})

describe('mock timers', () => {
  it('handles timers', () => {
    expectTransformation(
      `
        import sinon from 'sinon-sandbox'
        sinon.useFakeTimers()
        clock.restore()
        clock.tick(5)

        let clock1
        beforeEach(() => {
          foo()
          clock1 = sinon.useFakeTimers()
          bar()
        })

        foo()
        const clock = sinon.useFakeTimers()
        bar()

        beforeEach(() => {
          const clock2 = sinon.useFakeTimers(new Date(2015, 2, 14, 0, 0).getTime())
          clock1 = sinon.useFakeTimers(new Date(2015, 2, 14, 0, 0).getTime())
        })
`,
      `
        jest.useFakeTimers()
        jest.useRealTimers()
        jest.advanceTimersByTime(5)

        beforeEach(() => {
          foo()
          jest.useFakeTimers()
          bar()
        })

        foo()
        jest.useFakeTimers();
        bar()

        beforeEach(() => {
          jest.useFakeTimers().setSystemTime(new Date(2015, 2, 14, 0, 0).getTime());
          jest.useFakeTimers().setSystemTime(new Date(2015, 2, 14, 0, 0).getTime())
        })
`
    )
  })
})