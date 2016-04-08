import zerorpc
import sys
import numpy as np
import json

class HelloRPC(object):
	def initialize(self):
		pass

	def getNewMousePosition(self, currentInfo):
		currentInfo = json.loads(currentInfo)
		closest = self.findClosest(currentInfo['cell'], currentInfo['nodes'])
		if closest:
			return {'x': closest['position']['x'],'y': closest['position']['y'], 'message':closest}
		else:
			return {'x':0,'y':0, 'message': 'no food in view'}

	def findClosest(self, cell, otherNodes):
		closestDist = 100000
		closestNode = None
		a = np.array((cell['position']['x'], cell['position']['y']))
		# return otherNodes[0]
		for node in otherNodes:
			# return node
			b = np.array((node['position']['x'], node['position']['y']))

			dist = np.linalg.norm(a-b)
			if dist<closestDist and node['cellType'] == 1:
				closestDist = dist
				closestNode = node

		return closestNode

s = zerorpc.Server(HelloRPC())
print "python port", str(sys.argv[1])

s.bind("tcp://0.0.0.0:"+str(sys.argv[1]))
s.run()