import zerorpc
import sys

class HelloRPC(object):
	def initialize(self):
		pass

	def getNewMousePosition(self, currentInfo):
		print "text"
		return {'x': 50,'y': sys.argv[1]}

s = zerorpc.Server(HelloRPC())
print "python port", str(sys.argv[1])

s.bind("tcp://0.0.0.0:"+str(sys.argv[1]))
s.run()